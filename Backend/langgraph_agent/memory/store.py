import os
from typing import List, Dict, Optional
from collections import Counter
from datetime import datetime, timezone
from supabase import create_client, Client
from dotenv import load_dotenv

from .extractor import ExtractedFact
from .extractor import ExtractedFact

# Load env vars
load_dotenv()

# Singleton Supabase Client for Backend
_supabase: Optional[Client] = None

def get_supabase() -> Client:
    """Get or create singleton Supabase client with Service Role Key"""
    global _supabase
    if _supabase is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_KEY")
        if not url or not key:
            print("⚠️ Supabase credentials missing (SUPABASE_URL/SUPABASE_SERVICE_KEY)")
            return None
        _supabase = create_client(url, key)
    return _supabase


# In-memory store for development fallback
_memory_store: Dict[str, Dict[str, any]] = {}


async def store_fact(
    user_id: str,
    fact: ExtractedFact
) -> bool:
    """
    Store a single fact for user.
    Uses Supabase primarily, fallbacks to in-memory.
    """
    client = get_supabase()
    
    # Supported array fields in the user_preferences table
    array_fields = ["interests", "preferred_cities", "disliked_places", "dietary_restrictions"]
    
    if client:
        try:
            # 1. Get current preferences to handle array appending
            response = client.table("user_preferences").select("*").eq("user_id", user_id).execute()
            current = response.data[0] if response.data else {"user_id": user_id}
            
            update_data = {"user_id": user_id}
            
            if fact.key in array_fields:
                existing_array = current.get(fact.key) or []
                if fact.value not in existing_array:
                    update_data[fact.key] = existing_array + [fact.value]
                else:
                    return True # Already exists
            else:
                update_data[fact.key] = fact.value
            
            # 2. Upsert
            client.table("user_preferences").upsert(update_data, on_conflict="user_id").execute()
            return True
            
        except Exception as e:
            print(f"❌ Supabase store error: {e}")
            # Fallback to in-memory on error
    
    # FALLBACK to In-memory
    global _memory_store
    
    if user_id not in _memory_store:
        _memory_store[user_id] = {}
    
    user_data = _memory_store[user_id]
    
    if fact.key in array_fields:
        if fact.key not in user_data:
            user_data[fact.key] = []
        if fact.value not in user_data[fact.key]:
            user_data[fact.key].append(fact.value)
    else:
        user_data[fact.key] = fact.value
    
    return True


async def store_facts(
    user_id: str,
    facts: List[ExtractedFact]
) -> int:
    """
    Store multiple facts for user.
    Returns number of facts stored.
    """
    client = get_supabase()
    array_fields = ["interests", "preferred_cities", "disliked_places", "dietary_restrictions"]
    stored = 0
    
    if not client:
        # Fallback to single store
        for fact in facts:
            if await store_fact(user_id, fact):
                stored += 1
    else:
        try:
            response = client.table("user_preferences").select("*").eq("user_id", user_id).execute()
            current = response.data[0] if response.data else {"user_id": user_id}
            update_data = {"user_id": user_id}
            
            for fact in facts:
                if fact.key in array_fields:
                    existing = update_data.get(fact.key, current.get(fact.key) or [])
                    if fact.value not in existing:
                        update_data[fact.key] = existing + [fact.value]
                        stored += 1
                else:
                    if update_data.get(fact.key, current.get(fact.key)) != fact.value:
                        update_data[fact.key] = fact.value
                        stored += 1
                        
            if stored > 0:
                client.table("user_preferences").upsert(update_data, on_conflict="user_id").execute()
                
        except Exception as e:
            print(f"❌ Batch store_facts error: {e}")
            return 0
            
    # Invalidate cache if any facts stored
    if stored > 0:
        from ..nodes.profiler import invalidate_cache
        invalidate_cache(user_id)
    
    return stored


async def log_chat(
    user_id: str,
    session_id: str,
    message: str,
    response: str,
    emotion: str = "neutral",
    intent: str = "travel_query",
    location: Optional[str] = None,
    debug: Optional[Dict] = None,
    attachments: Optional[List[Dict]] = None
) -> bool:
    """
    Log chat to Supabase using the ACTUAL schema.
    
    Schema: user_id, session_id, role, message, context, model_used
    We log both user message and assistant response as separate rows.
    """
    client = get_supabase()
    if not client:
        return False
        
    try:
        # 1. Log user message
        client.table("chat_logs").insert({
            "user_id": user_id,
            "session_id": session_id,
            "role": "user",
            "message": message,
            "model_used": "langgraph",
            "context": {"attachments": attachments} if attachments else None
        }).execute()
        
        # 2. Log assistant response
        # Merge emotion/intent into context for frontend history loading
        context = debug or {}
        context["emotion"] = emotion
        context["intent"] = intent
        context["location_extracted"] = False # Track for background loop
        if location:
            context["location"] = location
        
        client.table("chat_logs").insert({
            "user_id": user_id,
            "session_id": session_id,
            "role": "assistant", 
            "message": response,
            "context": context,
            "model_used": "langgraph"
        }).execute()

        # 3. Update session metadata (updated_at and message_count)
        try:
            client.rpc("increment_session_message_count", {"p_session_id": session_id}).execute()
        except:
            # Fallback read-modify-write if RPC is not deployed yet
            session_res = client.table("chat_sessions").select("message_count").eq("id", session_id).execute()
            current_count = 0
            if session_res.data:
                current_count = session_res.data[0].get("message_count") or 0
            
            client.table("chat_sessions").update({
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "message_count": current_count + 1
            }).eq("id", session_id).execute()
        
        return True
            
    except Exception as e:
        print(f"❌ chat_logs error: {e}")
        return False


async def log_event(
    user_id: str,
    session_id: str,
    event_type: str,
    event_data: Optional[Dict] = None
) -> bool:
    """Log a user event to Supabase user_events table"""
    client = get_supabase()
    if not client:
        return False
        
    try:
        client.table("user_events").insert({
            "user_id": user_id,
            "session_id": session_id,
            "event_type": event_type,
            "event_data": event_data
        }).execute()
        return True
    except Exception as e:
        print(f"❌ user_events error: {e}")
        return False


async def get_user_memory(user_id: str) -> Dict:
    """Get all stored memory for user from Supabase or memory"""
    client = get_supabase()
    if client:
        try:
            response = client.table("user_preferences").select("*").eq("user_id", user_id).execute()
            if response.data:
                return response.data[0]
        except Exception as e:
            print(f"❌ Supabase fetch error: {e}")
            
    return _memory_store.get(user_id, {})


async def clear_user_memory(user_id: str) -> bool:
    """Clear all memory for user in Supabase and memory"""
    client = get_supabase()
    success = False
    
    if client:
        try:
            client.table("user_preferences").delete().eq("user_id", user_id).execute()
            success = True
        except Exception as e:
            print(f"❌ Supabase delete error: {e}")
            
    if user_id in _memory_store:
        del _memory_store[user_id]
        success = True
        
    if success:
        from ..nodes.profiler import invalidate_cache
        invalidate_cache(user_id)
        
    return success



async def get_chat_sessions(user_id: str) -> List[Dict]:
    """Fetch all chat sessions for a user from Supabase"""
    client = get_supabase()
    if not client:
        return []
        
    try:
        response = client.table("chat_sessions") \
            .select("*") \
            .eq("user_id", user_id) \
            .order("updated_at", desc=True) \
            .execute()
        return response.data
    except Exception as e:
        print(f"❌ get_chat_sessions error: {e}")
        return []


async def upsert_chat_session(
    user_id: str,
    session_id: str,
    title: str = "Cuộc hội thoại mới",
    first_message: str = None
) -> bool:
    """Create or update a chat session's metadata"""
    client = get_supabase()
    if not client:
        return False
        
    try:
        data = {
            "id": session_id,
            "user_id": user_id,
            "title": title,
            "updated_at": "now()"
        }
        if first_message:
            data["first_message"] = first_message
            
        client.table("chat_sessions").upsert(data, on_conflict="id").execute()
        return True
    except Exception as e:
        print(f"❌ upsert_chat_session error: {e}")
        return False


async def delete_chat_session(session_id: str) -> bool:
    """Delete a chat session and all its logs (cascade handled by DB or manually)"""
    client = get_supabase()
    if not client:
        return False
        
    try:
        # Delete logs first if cascade is not set up correctly
        client.table("chat_logs").delete().eq("session_id", session_id).execute()
        # Delete session
        client.table("chat_sessions").delete().eq("id", session_id).execute()
        return True
    except Exception as e:
        print(f"❌ delete_chat_session error: {e}")
        return False


async def cleanup_empty_chat_session(session_id: str) -> bool:
    """Deletes a chat session ONLY if it has zero messages in chat_logs"""
    client = get_supabase()
    if not client:
        return False
        
    try:
        # Check if any logs exist
        response = client.table("chat_logs").select("id", count="exact").eq("session_id", session_id).limit(1).execute()
        if response.count == 0:
            print(f"🧹 Cleaning up empty session: {session_id}")
            return await delete_chat_session(session_id)
        return False
    except Exception as e:
        print(f"❌ cleanup_empty_chat_session error: {e}")
        return False



async def get_user_preferences(user_id: str) -> Dict[str, any]:
    """Fetch user preferences from Supabase"""
    client = get_supabase()
    if not client:
        return {}
        
    try:
        response = client.table("user_preferences").select("*").eq("user_id", user_id).execute()
        return response.data[0] if response.data else {}
    except Exception as e:
        print(f"❌ get_user_preferences error: {e}")
        return {}


async def get_chat_sessions_count(user_id: str) -> int:
    """Get the number of chat sessions for a user"""
    client = get_supabase()
    if not client:
        return 0
        
    try:
        response = client.table("chat_sessions").select("id", count="exact").eq("user_id", user_id).execute()
        return response.count if response.count is not None else 0
    except Exception as e:
        print(f"❌ get_chat_sessions_count error: {e}")
        return 0


async def get_session_history(session_id: str) -> List[Dict]:
    """Fetch chat history for a specific session"""
    client = get_supabase()
    if not client:
        return []
        
    try:
        response = client.table("chat_logs") \
            .select("*") \
            .eq("session_id", session_id) \
            .order("created_at", desc=False) \
            .execute()
        return response.data
    except Exception as e:
        print(f"❌ get_session_history error: {e}")
        return []



async def check_location_duplicate(
    name: str, 
    threshold: float = 0.85
) -> List[Dict]:
    """
    Check if a location name has duplicates in locations_cache.
    Returns list of matches with similarity >= 60%.
    
    Args:
        name: Location name to check
        threshold: Similarity threshold for 'skip' action (default 0.85)
    
    Returns:
        List of {existing_id, existing_name, similarity_score, recommended_action}
    """
    client = get_supabase()
    if not client:
        return []
    
    try:
        result = client.rpc("check_location_duplicate", {
            "p_name": name,
            "p_threshold": threshold
        }).execute()
        return result.data or []
    except Exception as e:
        print(f"❌ check_location_duplicate error: {e}")
        return []


async def insert_location_smart(
    name: str,
    city: Optional[str] = None,
    province: Optional[str] = None,
    category: str = "other",
    description: Optional[str] = None,
    details: Optional[Dict] = None,
    source_id: Optional[int] = None
) -> Dict:
    """
    Smart insert location with duplicate handling.
    
    Actions:
        - >=85% similarity: Skip insert, return existing
        - 60-85% similarity: Merge into existing
        - <60% similarity: Insert as new
    
    Returns:
        {result_id, result_action, matched_with}
    """
    client = get_supabase()
    if not client:
        return {"result_action": "error", "error": "No database connection"}
    
    try:
        result = client.rpc("insert_location_smart", {
            "p_name": name,
            "p_city": city,
            "p_province": province,
            "p_category": category,
            "p_description": description,
            "p_details": details,
            "p_source_id": source_id
        }).execute()
        
        if result.data:
            return result.data[0]
        return {"result_action": "error", "error": "No result returned"}
    except Exception as e:
        print(f"❌ insert_location_smart error: {e}")
        return {"result_action": "error", "error": str(e)}


async def find_duplicate_locations(min_similarity: float = 0.6) -> List[Dict]:
    """
    Scan all locations_cache for duplicate pairs.
    
    Returns:
        List of {loc1_id, loc1_name, loc2_id, loc2_name, 
                 similarity_score, recommended_action}
    """
    client = get_supabase()
    if not client:
        return []
    
    try:
        result = client.rpc("find_duplicate_locations", {
            "p_min_similarity": min_similarity
        }).execute()
        return result.data or []
    except Exception as e:
        print(f"❌ find_duplicate_locations error: {e}")
        return []


async def cleanup_duplicate_locations(
    threshold: float = 0.85,
    dry_run: bool = True
) -> List[Dict]:
    """
    Cleanup duplicate locations in the database.
    
    Args:
        threshold: Similarity threshold (>=threshold: delete, <threshold: merge)
        dry_run: If True, only report what would be done
    
    Returns:
        List of {action_taken, affected_id, kept_id, 
                 affected_name, kept_name, similarity_score}
    """
    client = get_supabase()
    if not client:
        return []
    
    try:
        result = client.rpc("cleanup_duplicate_locations", {
            "p_threshold": threshold,
            "p_dry_run": dry_run
        }).execute()
        return result.data or []
    except Exception as e:
        print(f"❌ cleanup_duplicate_locations error: {e}")
        return []


async def get_recommendations(
    user_id: str,
    topics: Optional[List[str]] = None,
    limit: int = 5
) -> List[Dict]:
    client = get_supabase()
    if not client:
        return []
    
    try:
        result = client.rpc("get_recommendations", {
            "p_user_id": user_id,
            "p_topics": topics,
            "p_limit": limit
        }).execute()
        return result.data or []
    except Exception as e:
        print(f"❌ get_recommendations error: {e}")
        return []


async def get_location_analytics(limit: int = 10) -> List[Dict]:
    """
    Get statistics on most asked-about locations from chat logs context.
    Returns: List of {location: str, count: int, percentage: float}
    """
    client = get_supabase()
    if not client:
        return []
    
    try:
        response = client.table("chat_logs") \
            .select("context->>detected_location, context->>location, context->locations") \
            .not_.is_("context", "null") \
            .limit(2000) \
            .execute()
        
        counts = {}
        total_valid = 0
        for row in response.data:
            # When selecting keys directly, Supabase flattens them
            loc = row.get("location") or row.get("detected_location")
            
            # Fallback to locations list
            if not loc:
                locs = row.get("locations")
                if locs and isinstance(locs, list) and len(locs) > 0:
                    loc = locs[0]
            
            if loc and loc != "None":
                counts[loc] = counts.get(loc, 0) + 1
                total_valid += 1
        
        results = []
        sorted_counts = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:limit]
        for loc, count in sorted_counts:
            results.append({
                "location": loc,
                "count": count,
                "percentage": round((count / total_valid * 100), 1) if total_valid > 0 else 0
            })
        
        return results
    except Exception as e:
        print(f"❌ get_location_analytics error: {e}")
        return []


async def get_topic_analytics(limit: int = 10) -> List[Dict]:
    """
    Get statistics on most common intents/topics from chat logs.
    Returns: List of {topic: str, count: int, label: str}
    """
    client = get_supabase()
    if not client:
        return []
    
    # User-friendly labels and mapping
    TOPIC_LABELS = {
        "place_exploration": "Địa điểm tham quan",
        "history_culture": "Lịch sử / Thông tin",
        "budget_info": "Giá vé & Chi phí",
        "opening_hours": "Giờ mở cửa",
        "food_drink": "Ẩm thực",
        "transportation": "Di chuyển",
        "itinerary_planning": "Lịch trình",
        "accommodation": "Khách sạn",
        "chit_chat": "Tán gẫu",
        "negative_feedback": "Góp ý",
        "preference_update": "Sở thích",
        "unrelated": "Khác"
    }
    
    # Old to new mapping for backward compatibility
    INTENT_MAP = {
        "travel_query": "place_exploration",
        "budget_query": "budget_info",
        "food_recommendation": "food_drink",
        "itinerary_request": "itinerary_planning"
    }

    try:
        response = client.table("chat_logs") \
            .select("context->>intent") \
            .not_.is_("context->intent", "null") \
            .limit(2000) \
            .execute()
        
        counts = Counter()
        for row in response.data:
            intent = row.get("intent")
            if intent:
                # Map old to new
                mapped = INTENT_MAP.get(intent, intent)
                counts[mapped] += 1
        
        results = []
        for intent, count in counts.most_common(limit):
            results.append({
                "topic": intent,
                "label": TOPIC_LABELS.get(intent, intent),
                "count": count
            })
            
        return results
    except Exception as e:
        print(f"❌ get_topic_analytics error: {e}")
        return []
