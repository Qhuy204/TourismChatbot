from typing import List, Dict, Optional
import asyncio
import aiohttp

from ..state import MessageProcessingState
from ..retrieval.vqa_store import get_vqa_store
from .location_extractor import admin_manager, normalize_name


# Configuration
SEARCH_K = 10
FINAL_K = 3
MIN_SCORE = 0.5
LOCATION_BOOST = 0.15


def extract_location(text: str) -> Optional[str]:
    """
    Extract location from text using VNAdministrativeManager.
    Prioritizes districts then provinces.
    """
    matches = admin_manager.scan_text(text)
    if matches:
        return admin_manager.clean_name(matches[0]["name"])
    return None


def boost_by_location(results: List[Dict], location: Optional[str]) -> List[Dict]:
    """Boost score for documents that match the extracted location"""
    if not location:
        return results
        
    for item in results:
        # Check if location name is in question or answer
        text = (item.get("question", "") + " " + item.get("answer", "")).lower()
        text_norm = normalize_name(text)
        
        if location in text_norm:
            item["score"] += LOCATION_BOOST
            item["boosted"] = True # Mark for debugging
            
    return results


async def retrieve_context(state: MessageProcessingState) -> MessageProcessingState:
    """
    LangGraph node: Retrieve relevant VQA context with location awareness.
    """
    # Skip if query is not relevant
    if not state.is_relevant:
        state.retrieved_context = []
        return state
    
    # Get query to search
    query = state.rewritten_query or state.message
    
    try:
        # 1. Use detected location from intent node
        location = state.detected_location
        if location:
            print(f"📍 Retrieval Hard Filter: {location}")
            
        # 3. Search with location filter and intent-based routing
        from ..state import IntentType
        intent = state.intent
        pref = "places"
        if intent == IntentType.ACCOMMODATION:
            pref = "hotels"
        elif intent == IntentType.FOOD_RECOMMENDATION:
            pref = "food"
        elif intent == IntentType.ITINERARY_REQUEST:
            pref = "itinerary"
            
        print(f"🔍 Searching ('{pref}'): '{query}' with filter: '{location or 'None'}'")
        final_results = store.search(
            query=query,
            k=FINAL_K,
            min_score=MIN_SCORE,
            location_filter=location,
            preferred_collection=pref
        )
        
        matches_count = sum(1 for r in final_results if r.get("location_match"))
        if matches_count > 0:
            print(f"✨ Found {matches_count} matches for '{location}'")
            
        state.retrieved_context = final_results
        
    except Exception as e:
        print(f"❌ Retrieval error: {e}")
        state.retrieved_context = []
    
    return state


# Helper: Check image links
async def verify_image_urls(context: List[Dict]):
    """Quickly verify image URLs in parallel"""
    if not context: return

    timeout = aiohttp.ClientTimeout(total=1.5)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async def check(item):
            url = item.get("image_url")
            if not url: return
            try:
                async with session.head(url, allow_redirects=True) as resp:
                    if resp.status != 200:
                        print(f"⚠️ Dead Image: {url} ({resp.status})")
                        item["image_url"] = ""
            except Exception:
                # Timeout or connection error
                print(f"⚠️ Dead Image (Error): {url}")
                item["image_url"] = ""

        # Run checks in parallel
        await asyncio.gather(*(check(item) for item in context))


def format_context_for_prompt(context):
    """Format retrieved context for LLM prompt (optimized for Qwen VL)"""
    if not context:
        return ""

    lines = [
        "=== THÔNG TIN THAM KHẢO ===",
        "Bạn có thể sử dụng các ảnh dưới đây nếu phù hợp.",
        "Nếu dùng ảnh, hiển thị bằng Markdown: ![Mô tả](URL)"
    ]

    for i, item in enumerate(context[:3], 1):

        answer = item.get("answer", "")
        img = item.get("image_url", "")
        score = item.get("score", 0)

        if len(answer) > 250:
            answer = answer[:247] + "..."

        lines.append(f"\n--- Tài liệu {i} (relevance {score:.2f}) ---")
        lines.append(answer)

        if img:
            lines.append(f"Ảnh minh họa: {img}")

    return "\n".join(lines)