import re
import unicodedata
from typing import List, Dict, Optional
from dataclasses import dataclass

import os
import yaml
from ..utils.gemini_client import gemini_fast
from ..memory.store import get_supabase

import json

# Initialize configs from YAML
_config_path = os.path.join(os.path.dirname(__file__), "..", "configs", "location_extractor.yaml")
_admin_data_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "administrative_divisions_vn.json")

try:
    with open(_config_path, "r", encoding="utf-8") as f:
        _config = yaml.safe_load(f)
except Exception as e:
    print(f"⚠️ Error loading location extractor config: {e}")
    _config = {"vietnamese_map": {}, "valid_categories": []}

VIETNAMESE_MAP = _config.get("vietnamese_map", {})
VALID_CATEGORIES = set(_config.get("valid_categories", []))


def normalize_name(name: str) -> str:
    # Simple accent removal
    nfkd_form = unicodedata.normalize('NFKD', name)
    without_accents = "".join([c for c in nfkd_form if not unicodedata.combining(c)])
    
    # Handle 'đ' manually
    res = without_accents.replace('đ', 'd').replace('Đ', 'D')
    return res.lower().strip()

class VNAdministrativeManager:
    """Manages Vietnamese administrative divisions for normalization and disambiguation"""
    _instance = None
    _provinces = {}  # name -> data
    _districts = {}   # name + province -> data
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(VNAdministrativeManager, cls).__new__(cls)
            cls._instance._load_data()
        return cls._instance
    
    def _load_data(self):
        if not os.path.exists(_admin_data_path):
            print(f"⚠️ Administrative data not found at {_admin_data_path}")
            return
            
        try:
            with open(_admin_data_path, 'r', encoding='utf-8') as f:
                raw_data = json.load(f).get('data', [])
                for p in raw_data:
                    p_name = p['name']
                    self._provinces[self._clean(p_name)] = {
                        "id": p['level1_id'],
                        "name": p_name,
                        "type": p['type']
                    }
                    for d in p.get('level2s', []):
                        d_name = d['name']
                        key = f"{self._clean(d_name)}|{self._clean(p_name)}"
                        self._districts[key] = {
                            "id": d['level2_id'],
                            "name": d_name,
                            "type": d['type'],
                            "parent_province": p_name
                        }
            
            # Add common aliases
            if "ho chi minh" in self._provinces:
                hcm_data = self._provinces["ho chi minh"]
                self._provinces["sai gon"] = hcm_data
                self._provinces["tphcm"] = hcm_data
                self._provinces["hcm"] = hcm_data
            
            if "ha noi" in self._provinces:
                hn_data = self._provinces["ha noi"]
                self._provinces["hn"] = hn_data
                
            print(f"✅ Loaded {len(self._provinces)} provinces and {len(self._districts)} districts plus aliases")
        except Exception as e:
            print(f"❌ Error parsing administrative data: {e}")

    def _clean(self, text: str) -> str:
        if not text: return ""
        # Remove common prefixes for matching
        prefixes = ["Thành phố ", "Tỉnh ", "Quận ", "Huyện ", "Thị xã "]
        cleaned = text
        for p in prefixes:
            if cleaned.startswith(p):
                cleaned = cleaned[len(p):]
        return normalize_name(cleaned)

    def find_province(self, name: str) -> Optional[Dict]:
        return self._provinces.get(self._clean(name))

    def find_district(self, name: str, province_name: Optional[str] = None) -> Optional[Dict]:
        c_name = self._clean(name)
        if province_name:
            key = f"{c_name}|{self._clean(province_name)}"
            return self._districts.get(key)
        
        # If no province provided, search all (risky for disambiguation)
        for key, data in self._districts.items():
            if key.startswith(f"{c_name}|"):
                return data
        return None

    def scan_text(self, text: str) -> List[Dict]:
        """Fast scan for administrative names in text"""
        results = []
        # Simple normalization for matching
        text = text.lower()
        text_norm = normalize_name(text)
        
        # Check provinces (high priority)
        # Sort by length desc to match "Ho Chi Minh" before "Minh" (if any)
        sorted_provinces = sorted(self._provinces.items(), key=lambda x: len(x[0]), reverse=True)
        
        for p_norm, p_data in sorted_provinces:
            # Basic word boundary check equivalent
            if p_norm in text_norm:
                 results.append({"name": p_data["name"], "type": "province"})
                 
        return results[:3] # Limit to top 3

def fast_extract_locations(text: str) -> List[Dict]:
    """
    Quickly extract locations using pattern matching.
    Used for immediate UI updates (suggestions) without waiting for AI.
    """
    manager = VNAdministrativeManager()
    return manager.scan_text(text)

# Singleton instance
admin_manager = VNAdministrativeManager()

@dataclass
class ExtractedLocation:
    """Represents an extracted location from response"""
    name: str                    # "Phố cổ Hội An"
    city: Optional[str]          # "Hội An"
    province: Optional[str]      # "Quảng Nam"
    category: str                # beach|heritage|nature|food|temple|city|other
    description: Optional[str]   # Brief description from response
    admin_id: Optional[str] = None # level1_id or level2_id



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
    
    prompt = f"""Trích xuất danh sách các địa điểm du lịch Việt Nam cụ thể được đề cập trong văn bản.
Chỉ trích xuất các địa điểm thực tế (danh lam, thắng cảnh, bảo tàng, v.v.), bỏ qua các tên chung chung như "thành phố", "tỉnh".

Văn bản:
{response_text[:2500]}

Trả về JSON array các object:
{{
  "locations": [
    {{
      "name": "Tên địa điểm",
      "city": "Thành phố/Thị xã",
      "province": "Tỉnh/Thành",
      "category": "beach|heritage|nature|food|temple|city|mountain|island|museum|other",
      "description": "Mô tả cực ngắn (dưới 15 từ)"
    }}
  ]
}}
Nếu không có địa điểm nào, trả về {{"locations": []}}."""

    try:
        result = await gemini_fast.generate_json(
            prompt=prompt,
            schema={"locations": "array of objects"},
            max_tokens=4096  # Increased to prevent truncation
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
            
            # Normalize against dataset
            p_val = loc.get("province")
            c_val = loc.get("city")
            admin_id = None
            
            if p_val:
                p_match = admin_manager.find_province(p_val)
                if p_match:
                    p_val = p_match['name']
                    admin_id = p_match['id']
            
            if c_val:
                d_match = admin_manager.find_district(c_val, p_val)
                if d_match:
                    c_val = d_match['name']
                    p_val = d_match['parent_province'] # Resolve province if only city was known
                    admin_id = d_match['id']

            locations.append(ExtractedLocation(
                name=name,
                city=c_val,
                province=p_val,
                category=category,
                description=loc.get("description") or None,
                admin_id=admin_id
            ))
        
        if locations:
            names = [f"{l.name} ({l.province or '?'})" for l in locations]
            print(f"✨ Extracted {len(locations)} locations: {names}")
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
    
    # Build data and deduplicate by name_normalized
    seen_names = {}
    for loc in locations:
        name_normalized = normalize_name(loc.name)
        # Only keep first occurrence (or update with more complete data)
        if name_normalized not in seen_names:
            seen_names[name_normalized] = {
                "name": loc.name,
                "name_normalized": name_normalized,
                "city": loc.city,
                "province": loc.province,
                "category": loc.category,
                "description": loc.description,
                "details": {"admin_id": loc.admin_id} if loc.admin_id else None,
                "source_response_id": source_response_id
            }
    
    data_to_store = list(seen_names.values())
    
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
