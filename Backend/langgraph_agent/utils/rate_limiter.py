from typing import Optional, Dict
from langgraph_agent.memory.store import get_supabase
import threading

# In-memory cache for quota limits (refreshed every 5 min)
_quota_cache: Dict[str, dict] = {}
_cache_ts: float = 0
_quota_lock = threading.Lock()


def _get_quota_limits() -> Dict[str, dict]:
    """Get quota limits per role (cached)"""
    import time
    global _quota_cache, _cache_ts

    with _quota_lock:
        if time.time() - _cache_ts < 300 and _quota_cache:
            return _quota_cache

        try:
            sb = get_supabase()
            resp = sb.table("quota_limits").select("*").execute()
            _quota_cache = {row["role"]: row for row in (resp.data or [])}
            _cache_ts = time.time()
        except Exception as e:
            print(f"⚠️ Failed to load quota limits: {e}")
            # Fallback defaults
            _quota_cache = {
                "user": {"daily_requests": 50, "daily_tokens": 100000, "daily_images": 10},
                "admin": {"daily_requests": 999999, "daily_tokens": 999999999, "daily_images": 9999},
                "api_client": {"daily_requests": 200, "daily_tokens": 500000, "daily_images": 50},
            }
            _cache_ts = time.time()

    return _quota_cache


def get_user_role(user_id: str) -> str:
    """Get user's role from user_roles table"""
    try:
        sb = get_supabase()
        resp = sb.table("user_roles").select("role").eq("user_id", user_id).execute()
        if resp.data:
            return resp.data[0]["role"]
    except Exception:
        pass
    return "user"


def get_user_usage(user_id: str) -> dict:
    """Get today's usage for a user"""
    try:
        sb = get_supabase()
        from datetime import date
        today = date.today().isoformat()

        resp = (
            sb.table("usage_tracking")
            .select("request_count, token_count, image_count")
            .eq("user_id", user_id)
            .eq("date", today)
            .execute()
        )

        if resp.data:
            return resp.data[0]
    except Exception:
        pass

    return {"request_count": 0, "token_count": 0, "image_count": 0}


def check_quota(user_id: str) -> tuple[bool, Optional[str], dict]:
    """
    Check if user is within quota limits.
    Returns: (allowed, reason_if_denied, usage_info)
    """
    role = get_user_role(user_id)
    limits = dict(_get_quota_limits().get(role, _get_quota_limits().get("user", {})))
    
    # Check for user-specific overrides
    try:
        sb = get_supabase()
        override_resp = sb.table("user_quota_overrides").select("*").eq("user_id", user_id).execute()
        if override_resp.data:
            override = override_resp.data[0]
            if override.get("daily_requests") is not None:
                limits["daily_requests"] = override["daily_requests"]
            if override.get("daily_tokens") is not None:
                limits["daily_tokens"] = override["daily_tokens"]
    except Exception as e:
        pass

    usage = get_user_usage(user_id)

    daily_limit = limits.get("daily_requests", 50)
    current = usage.get("request_count", 0)

    usage_info = {
        "role": role,
        "used": current,
        "limit": daily_limit,
        "remaining": max(0, daily_limit - current),
        "tokens_used": usage.get("token_count", 0),
        "tokens_limit": limits.get("daily_tokens", 100000),
    }

    if current >= daily_limit:
        return False, f"Đã hết quota hôm nay ({current}/{daily_limit} requests). Vui lòng quay lại ngày mai.", usage_info

    return True, None, usage_info


def increment_usage(user_id: str, requests: int = 1, tokens: int = 0, images: int = 0) -> None:
    """Increment usage counters for user"""
    try:
        sb = get_supabase()
        sb.rpc("increment_usage", {
            "p_user_id": user_id,
            "p_requests": requests,
            "p_tokens": tokens,
            "p_images": images,
        }).execute()
    except Exception as e:
        print(f"⚠️ Failed to increment usage: {e}")
