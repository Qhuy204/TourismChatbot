"""
Memory Store
Persists validated facts to database and invalidates cache
"""
import os
from typing import List, Dict, Optional
from supabase import create_client, Client
from dotenv import load_dotenv

from .extractor import ExtractedFact
from ..nodes.profiler import invalidate_cache

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
    stored = 0
    
    for fact in facts:
        success = await store_fact(user_id, fact)
        if success:
            stored += 1
    
    # Invalidate cache if any facts stored
    if stored > 0:
        invalidate_cache(user_id)
    
    return stored


async def log_chat(
    user_id: str,
    session_id: str,
    message: str,
    response: str,
    emotion: str = None,
    intent: str = None,
    debug: Optional[Dict] = None
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
        # Log user message
        client.table("chat_logs").insert({
            "user_id": user_id,
            "session_id": session_id,
            "role": "user",
            "message": message,
            "model_used": "langgraph"
        }).execute()
        
        # Log assistant response
        client.table("chat_logs").insert({
            "user_id": user_id,
            "session_id": session_id,
            "role": "assistant", 
            "message": response,
            "context": debug,  # Store debug info in context column (JSONB)
            "model_used": "langgraph"
        }).execute()
        
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
        invalidate_cache(user_id)
        
    return success
