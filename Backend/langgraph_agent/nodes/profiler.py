"""
User Profiler Node
Loads and caches user profile from database
"""
import time
from typing import Optional, Dict, List

from ..state import UserContextState


# In-memory cache (replace with Redis in production)
_profile_cache: Dict[str, UserContextState] = {}
CACHE_TTL = 1800  # 30 minutes


async def load_from_database(user_id: str) -> Dict:
    """
    Load user data from Supabase.
    """
    from ..memory.store import get_user_memory
    return await get_user_memory(user_id)


def get_cached_profile(user_id: str) -> Optional[UserContextState]:
    """Get profile from cache if valid"""
    if user_id in _profile_cache:
        profile = _profile_cache[user_id]
        if profile.is_cache_valid(CACHE_TTL):
            return profile
        else:
            # Expired, remove from cache
            del _profile_cache[user_id]
    return None


def cache_profile(profile: UserContextState) -> None:
    """Store profile in cache"""
    profile.cached_at = time.time()
    _profile_cache[profile.user_id] = profile


def invalidate_cache(user_id: str) -> None:
    """Invalidate user's cached profile"""
    if user_id in _profile_cache:
        del _profile_cache[user_id]


def extract_interests(events: List[Dict]) -> List[str]:
    """Extract top interests from user events"""
    # Count interest occurrences
    interest_counts = {}
    for event in events:
        payload = event.get("payload", {})
        if isinstance(payload, dict):
            for tag in payload.get("tags", []):
                interest_counts[tag] = interest_counts.get(tag, 0) + 1
    
    # Sort by count and return top 5
    sorted_interests = sorted(interest_counts.items(), key=lambda x: x[1], reverse=True)
    return [interest for interest, _ in sorted_interests[:5]]


def extract_recent_searches(events: List[Dict]) -> List[str]:
    """Extract recent search queries"""
    searches = []
    for event in events:
        if event.get("event_type") == "search":
            query = event.get("payload", {}).get("query", "")
            if query and query not in searches:
                searches.append(query)
                if len(searches) >= 10:
                    break
    return searches


async def load_user_profile(state: UserContextState) -> UserContextState:
    """
    LangGraph node: Load user profile with caching.
    Checks cache first, then loads from DB if needed.
    """
    # Check cache first
    cached = get_cached_profile(state.user_id)
    if cached:
        # Copy cached data to state
        state.preferred_cities = cached.preferred_cities
        state.travel_style = cached.travel_style
        state.budget_range = cached.budget_range
        state.recent_searches = cached.recent_searches
        state.interests = cached.interests
        state.cached_at = cached.cached_at
        return state
    
    # Load from database
    data = await load_from_database(state.user_id)
    
    state.preferred_cities = data.get("preferred_cities") or []
    state.travel_style = data.get("travel_style", "") or ""
    state.budget_range = data.get("budget_range", "") or ""
    state.recent_searches = data.get("recent_searches") or []
    state.interests = data.get("interests") or []
    
    # Cache the profile
    cache_profile(state)
    
    return state
