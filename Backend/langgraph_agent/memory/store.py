"""
Memory Store
Persists validated facts to database and invalidates cache
"""
import os
from typing import List, Dict, Optional
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
    stored = 0
    
    for fact in facts:
        success = await store_fact(user_id, fact)
        if success:
            stored += 1
    
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
        from ..nodes.profiler import invalidate_cache
        invalidate_cache(user_id)
        
    return success


# ============== Chat Session Management ==============

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
