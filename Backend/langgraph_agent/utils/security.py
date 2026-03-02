"""
Security Middleware
- IP-based rate limiting (DDoS/abuse prevention)
- Request logging for audit trail
- Admin action audit logging
- JWT Authorization for Admin endpoints
"""
import time
from collections import defaultdict
from typing import Optional, Dict
from pydantic import BaseModel
from fastapi import Request, HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from langgraph_agent.memory.store import get_supabase

# ============== Admin Auth & Rate Limits ==============

security = HTTPBearer()

class Admin(BaseModel):
    id: str
    email: str
    role: str

# Tiered limits configuration
ADMIN_RATE_LIMITS = {
    "global": 300,
    "per_admin": 120,
    "heavy": 20,    # metrics
    "standard": 60  # users
}

# ============== Admin Auth & Rate Limits ==============

from collections import deque

security = HTTPBearer()

class Admin(BaseModel):
    id: str
    email: str
    role: str

# Tiered limits configuration
ADMIN_RATE_LIMITS = {
    "global": 300,
    "per_admin": 120,
    "heavy": 20,    # metrics
    "standard": 60  # users
}

# In-memory rate limit storage (sliding window)
# Key: limit_type:id, Value: deque of timestamps
_rate_limit_store: Dict[str, deque] = defaultdict(deque)

def _check_in_mem_limit(key: str, limit: int, window: int = 60) -> int:
    """Helper for in-memory sliding window rate limiting"""
    now = time.time()
    history = _rate_limit_store[key]
    
    # Remove expired timestamps
    while history and history[0] < now - window:
        history.popleft()
        
    if len(history) >= limit:
        return -1 # Rate limited
        
    history.append(now)
    return limit - len(history)

def check_admin_rate_limit(admin_id: str, tier: str = "standard") -> None:
    """In-memory sliding window rate limiting for Admins"""
    # 1. Global Admin Limit
    if _check_in_mem_limit("rl:admin:global", ADMIN_RATE_LIMITS["global"]) < 0:
        raise HTTPException(status_code=429, detail="Global Admin Rate Limit Exceeded")
    
    # 2. Per Admin Limit & Tiered Limit
    # We use the same history for both per_admin and the specific tier
    # but we check the stricter one first
    strictest_limit = min(ADMIN_RATE_LIMITS["per_admin"], ADMIN_RATE_LIMITS[tier])
    
    # Note: Using _check_in_mem_limit here will append a timestamp, 
    # so we should be careful about double counting if we call it twice.
    # Instead, we'll manually check the deque for the admin.
    admin_key = f"rl:admin:per:{admin_id}"
    history = _rate_limit_store[admin_key]
    
    now = time.time()
    while history and history[0] < now - 60:
        history.popleft()
        
    if len(history) >= strictest_limit:
        detail = "Individual Admin Rate Limit Exceeded" if strictest_limit == ADMIN_RATE_LIMITS["per_admin"] else f"Admin Endpoint Rate Limit Exceeded ({tier})"
        raise HTTPException(status_code=429, detail=detail)
    
    history.append(now)

async def require_admin(credentials: HTTPAuthorizationCredentials = Security(security)) -> Admin:
    """Dependency that checks JWT and enforces admin role"""
    sb = get_supabase()
    try:
        user_res = sb.auth.get_user(credentials.credentials)
        if not user_res or not user_res.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
            
        user_id = user_res.user.id
        user_email = user_res.user.email
        
        # Check role
        role_res = sb.table("user_roles").select("role").eq("user_id", user_id).execute()
        
        if not role_res.data or len(role_res.data) == 0 or role_res.data[0]["role"] != "admin":
            raise HTTPException(status_code=403, detail="Forbidden: Admin access required")
            
        return Admin(id=user_id, email=user_email, role="admin")
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=401, detail=str(e))


# ============== IP Rate Limiting ==============

_IP_WINDOW_SECONDS = 60
_IP_MAX_REQUESTS = 30

def check_ip_rate_limit(ip: str) -> tuple[bool, int]:
    """In-memory sliding window rate limiting for IPs"""
    remaining = _check_in_mem_limit(f"rl:ip:{ip}", _IP_MAX_REQUESTS, _IP_WINDOW_SECONDS)
    if remaining < 0:
        return False, 0
    return True, remaining


# ============== Audit Logging ==============

def log_admin_action(
    admin_user_id: str,
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    justification: Optional[str] = None,
    metadata: Optional[dict] = None,
    ip_address: Optional[str] = None,
    request_id: Optional[str] = None,
) -> None:
    """Log an admin action to admin_audit_logs table with cryptographic immutability provided by DB triggers"""
    try:
        sb = get_supabase()
        
        # Get last hash
        last_log = sb.table("admin_audit_logs").select("current_hash").order("timestamp", desc=True).limit(1).execute()
        prev_hash = last_log.data[0]["current_hash"] if last_log.data else None
        
        sb.table("admin_audit_logs").insert({
            "admin_id": admin_user_id,
            "action": action,
            "target_type": target_type,
            "target_id": target_id,
            "justification": justification,
            "metadata": metadata or {},
            "ip_address": ip_address,
            "request_id": request_id,
            "previous_hash": prev_hash
        }).execute()
    except Exception as e:
        print(f"⚠️ Audit log failed: {e}")


# ============== Security Headers ==============

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Referrer-Policy": "strict-origin-when-cross-origin",
}
