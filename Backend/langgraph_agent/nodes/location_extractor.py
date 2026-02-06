import re
import unicodedata
from typing import List, Dict, Optional
from dataclasses import dataclass

import os
import yaml
from ..utils.gemini_client import gemini_fast
from ..memory.store import get_supabase

# Initialize configs from YAML
_config_path = os.path.join(os.path.dirname(__file__), "..", "configs", "location_extractor.yaml")
try:
    with open(_config_path, "r", encoding="utf-8") as f:
        _config = yaml.safe_load(f)
except Exception as e:
    print(f"⚠️ Error loading location extractor config: {e}")
    _config = {"vietnamese_map": {}, "valid_categories": []}

VIETNAMESE_MAP = _config.get("vietnamese_map", {})
VALID_CATEGORIES = set(_config.get("valid_categories", []))


@dataclass
class ExtractedLocation:
    """Represents an extracted location from response"""
    name: str                    # "Phố cổ Hội An"
    city: Optional[str]          # "Hội An"
    province: Optional[str]      # "Quảng Nam"
    category: str                # beach|heritage|nature|food|temple|city|other
    description: Optional[str]   # Brief description from response


def normalize_name(name: str) -> str:
    """
    Normalize location name for deduplication.
    Removes Vietnamese accents and converts to lowercase.
    """
    for vn_char, ascii_char in VIETNAMESE_MAP.items():
        name = name.replace(vn_char, ascii_char)
    
    # Normalize unicode and remove diacritics
    normalized = unicodedata.normalize('NFD', name)
    without_accents = ''.join(c for c in normalized if unicodedata.category(c) != 'Mn')
    
    # Lowercase and strip
    return without_accents.lower().strip()


async def extract_locations(response_text: str) -> List[ExtractedLocation]:
    """
    Extract location mentions from response using Gemini.
    
    Args:
        response_text: The chatbot response to analyze
        
    Returns:
        List of structured location data
    """
    if not response_text or len(response_text) < 20:
        return []
    
    print(f"🔍 Extracting locations from response ({len(response_text)} chars)...")
    
    prompt = f"""Trích xuất tất cả địa điểm du lịch Việt Nam được đề cập trong đoạn văn sau.

Với mỗi địa điểm, cung cấp:
- name: Tên đầy đủ của địa điểm
- city: Thành phố (nếu biết)
- province: Tỉnh/Thành (nếu biết)
- category: Một trong: beach, heritage, nature, food, temple, city, mountain, island, museum, other
- description: Mô tả ngắn từ văn bản (nếu có đề cập)

Văn bản:
{response_text[:2000]}

Trả về JSON với format:
{{"locations": [{{"name": "...", "city": "...", "province": "...", "category": "...", "description": "..."}}]}}

Nếu không có địa điểm nào, trả về: {{"locations": []}}"""
    
    try:
        result = await gemini_fast.generate_json(
            prompt=prompt,
            schema={"locations": "array of location objects"}
        )
        
        locations = []
        raw_locations = result.get("locations", [])
        
        # Handle different response formats
        if isinstance(raw_locations, str):
            return []
            
        for loc in raw_locations:
            if not isinstance(loc, dict):
                continue
                
            name = loc.get("name", "").strip()
            if not name or len(name) < 2:
                continue
            
            # Validate category
            category = loc.get("category", "other").lower()
            if category not in VALID_CATEGORIES:
                category = "other"
            
            locations.append(ExtractedLocation(
                name=name,
                city=loc.get("city") or None,
                province=loc.get("province") or None,
                category=category,
                description=loc.get("description") or None
            ))
        
        if locations:
            print(f"✨ Extracted {len(locations)} locations: {[l.name for l in locations]}")
        else:
            print("📭 No locations found in response.")
            
        return locations
        
    except Exception as e:
        print(f"⚠️ Location extraction error: {e}")
        return []


async def store_locations(
    locations: List[ExtractedLocation],
    source_response_id: Optional[int] = None
) -> int:
    """
    Store extracted locations to Supabase.
    Uses upsert to avoid duplicates.
    
    Args:
        locations: List of extracted locations
        source_response_id: Optional chat_logs ID for tracking
        
    Returns:
        Number of locations stored
    """
    if not locations:
        return 0
    
    client = get_supabase()
    if not client:
        print("⚠️ No Supabase client - skipping location storage")
        return 0
    
    stored = 0
    
    data_to_store = []
    
    for loc in locations:
        name_normalized = normalize_name(loc.name)
        data_to_store.append({
            "name": loc.name,
            "name_normalized": name_normalized,
            "city": loc.city,
            "province": loc.province,
            "category": loc.category,
            "description": loc.description,
            "source_response_id": source_response_id
        })
    
    try:
        if data_to_store:
            # Batch upsert to handle duplicates and speed up storage
            client.table("locations_cache").upsert(
                data_to_store, 
                on_conflict="name_normalized"
            ).execute()
            stored = len(data_to_store)
            print(f"✅ Stored {stored} locations to cache in batch")
            return stored
    except Exception as e:
        print(f"⚠️ Batch store locations error: {e}")
        return 0
    
    return 0


async def get_cached_locations(
    category: Optional[str] = None,
    city: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100
) -> List[Dict]:
    """
    Get cached locations with optional filtering.
    
    Args:
        category: Filter by category
        city: Filter by city
        search: Full-text search query
        limit: Max results
        
    Returns:
        List of location dicts
    """
    client = get_supabase()
    if not client:
        return []
    
    try:
        query = client.table("locations_cache").select(
            "id, name, city, province, category, description"
        )
        
        if category:
            query = query.eq("category", category)
        
        if city:
            query = query.ilike("city", f"%{city}%")
        
        if search:
            # Use ilike for simple search
            query = query.or_(
                f"name.ilike.%{search}%,"
                f"city.ilike.%{search}%,"
                f"province.ilike.%{search}%"
            )
        
        response = query.order("extracted_at", desc=True).limit(limit).execute()
        
        return response.data or []
        
    except Exception as e:
        print(f"❌ Get locations error: {e}")
        return []


async def get_location_stats() -> Dict:
    """Get statistics about cached locations"""
    client = get_supabase()
    if not client:
        return {}
    
    try:
        response = client.table("locations_cache").select(
            "category", count="exact"
        ).execute()
        
        # Count by category
        categories = {}
        for item in (response.data or []):
            cat = item.get("category", "other")
            categories[cat] = categories.get(cat, 0) + 1
        
        return {
            "total": response.count or len(response.data or []),
            "by_category": categories
        }
        
    except Exception as e:
        print(f"❌ Location stats error: {e}")
        return {}
