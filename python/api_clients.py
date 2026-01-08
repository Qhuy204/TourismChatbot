"""
Gemini API Client with Real Quota Tracking
Fetches real model list and tracks RPM/TPM/RPD usage
"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from collections import defaultdict
import json
import os

# Rate limits per model (from Google AI Studio)
MODEL_RATE_LIMITS = {
    "gemini-2.5-flash": {"rpm": 1000, "tpm": 1000000, "rpd": 10000, "category": "Text-out models"},
    "gemini-2.5-pro": {"rpm": 150, "tpm": 2000000, "rpd": 10000, "category": "Text-out models"},
    "gemini-2.5-flash-lite": {"rpm": 4000, "tpm": 4000000, "rpd": -1, "category": "Text-out models"},
    "gemini-2.0-flash": {"rpm": 2000, "tpm": 4000000, "rpd": -1, "category": "Text-out models"},
    "gemini-2.0-flash-lite": {"rpm": 4000, "tpm": 4000000, "rpd": -1, "category": "Text-out models"},
    "gemini-2.0-flash-exp": {"rpm": 10, "tpm": 250000, "rpd": 500, "category": "Text-out models"},
    "gemini-3-flash": {"rpm": 1000, "tpm": 1000000, "rpd": 10000, "category": "Text-out models"},
    "gemini-3-pro": {"rpm": 25, "tpm": 1000000, "rpd": 250, "category": "Text-out models"},
    "gemini-3-pro-image": {"rpm": 20, "tpm": 100000, "rpd": 250, "category": "Multi-modal generative models"},
    "gemini-2.5-flash-preview-image": {"rpm": 500, "tpm": 500000, "rpd": 2000, "category": "Multi-modal generative models"},
    "gemini-2.5-flash-image": {"rpm": 500, "tpm": 500000, "rpd": 2000, "category": "Multi-modal generative models"},
    "gemini-2.5-flash-tts": {"rpm": 10, "tpm": 10000, "rpd": 100, "category": "Multi-modal generative models"},
    "gemini-2.5-pro-tts": {"rpm": 10, "tpm": 10000, "rpd": 50, "category": "Multi-modal generative models"},
    "computer-use-preview": {"rpm": 150, "tpm": 2000000, "rpd": 10000, "category": "Other models"},
    "deep-research-pro-preview": {"rpm": 1, "tpm": 500000, "rpd": 1440, "category": "Agents"},
    "gemini-robotics-er-1.5-preview": {"rpm": 1000, "tpm": 2000000, "rpd": 14400, "category": "Other models"},
    "gemma-3-1b": {"rpm": 30, "tpm": 15000, "rpd": 14400, "category": "Other models"},
    "gemma-3-4b": {"rpm": 30, "tpm": 15000, "rpd": 14400, "category": "Other models"},
    "gemma-3-12b": {"rpm": 30, "tpm": 15000, "rpd": 14400, "category": "Other models"},
    "gemma-3-27b": {"rpm": 30, "tpm": 15000, "rpd": 14400, "category": "Other models"},
    "imagen-4.0-fast-generate": {"rpm": 10, "tpm": None, "rpd": 70, "category": "Multi-modal generative models"},
    "imagen-4.0-generate": {"rpm": 10, "tpm": None, "rpd": 70, "category": "Multi-modal generative models"},
    "imagen-4.0-ultra-generate": {"rpm": 5, "tpm": None, "rpd": 30, "category": "Multi-modal generative models"},
    "veo-3.0-fast-generate": {"rpm": 2, "tpm": None, "rpd": 10, "category": "Multi-modal generative models"},
    "veo-3.0-generate": {"rpm": 2, "tpm": None, "rpd": 10, "category": "Multi-modal generative models"},
    "embedding-001": {"rpm": 3000, "tpm": 1000000, "rpd": -1, "category": "Other models"},
    "gemini-embedding-1.0": {"rpm": 3000, "tpm": 1000000, "rpd": -1, "category": "Other models"},
}

@dataclass
class UsageRecord:
    timestamp: datetime
    tokens: int
    model: str

@dataclass
class APIKeyUsage:
    key_id: str
    key_preview: str  # Last 4 chars
    requests_minute: List[UsageRecord] = field(default_factory=list)
    requests_day: List[UsageRecord] = field(default_factory=list)
    tokens_minute: int = 0
    total_requests_today: int = 0
    total_tokens_today: int = 0
    last_error: Optional[str] = None
    is_valid: bool = True

class GeminiClient:
    def __init__(self):
        self.api_keys: Dict[str, APIKeyUsage] = {}
        self.models_cache: List[Dict] = []
        self.models_cache_time: Optional[datetime] = None
        self.usage_file = "gemini_usage.json"
        self._load_usage()
    
    def _load_usage(self):
        """Load usage data from file"""
        try:
            if os.path.exists(self.usage_file):
                with open(self.usage_file, 'r') as f:
                    data = json.load(f)
                    for key_id, usage in data.get("keys", {}).items():
                        self.api_keys[key_id] = APIKeyUsage(
                            key_id=key_id,
                            key_preview=usage.get("preview", "****"),
                            total_requests_today=usage.get("requests_today", 0),
                            total_tokens_today=usage.get("tokens_today", 0),
                            is_valid=usage.get("is_valid", True)
                        )
        except Exception as e:
            print(f"Error loading usage: {e}")
    
    def _save_usage(self):
        """Save usage data to file"""
        try:
            data = {
                "keys": {
                    key_id: {
                        "preview": usage.key_preview,
                        "requests_today": usage.total_requests_today,
                        "tokens_today": usage.total_tokens_today,
                        "is_valid": usage.is_valid
                    }
                    for key_id, usage in self.api_keys.items()
                },
                "last_updated": datetime.now().isoformat()
            }
            with open(self.usage_file, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"Error saving usage: {e}")
    
    def add_api_key(self, api_key: str) -> bool:
        """Add a new API key and validate it"""
        if not api_key or len(api_key) < 10:
            return False
        
        key_id = api_key[:8] + "..." + api_key[-4:]
        self.api_keys[api_key] = APIKeyUsage(
            key_id=api_key,
            key_preview=api_key[-4:],
            is_valid=True
        )
        self._save_usage()
        return True
    
    def remove_api_key(self, api_key: str):
        """Remove an API key"""
        if api_key in self.api_keys:
            del self.api_keys[api_key]
            self._save_usage()
    
    async def validate_api_key(self, api_key: str) -> tuple[bool, str]:
        """Validate API key by making a test request"""
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            
            # Try to list models
            models = list(genai.list_models())
            if models:
                if api_key in self.api_keys:
                    self.api_keys[api_key].is_valid = True
                    self._save_usage()
                return True, f"Valid - {len(models)} models available"
            return False, "No models found"
        except Exception as e:
            error_msg = str(e)
            if api_key in self.api_keys:
                self.api_keys[api_key].is_valid = False
                self.api_keys[api_key].last_error = error_msg[:100]
                self._save_usage()
            return False, error_msg[:100]
    
    async def fetch_models(self, api_key: str) -> List[Dict]:
        """Fetch available models from Gemini API"""
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            
            models = []
            for m in genai.list_models():
                if 'generateContent' in m.supported_generation_methods:
                    model_name = m.name.replace("models/", "")
                    limits = MODEL_RATE_LIMITS.get(model_name, {})
                    
                    models.append({
                        "name": model_name,
                        "display_name": m.display_name if hasattr(m, 'display_name') else model_name,
                        "description": m.description[:200] if m.description else "",
                        "input_token_limit": m.input_token_limit,
                        "output_token_limit": m.output_token_limit,
                        "category": limits.get("category", "Other models"),
                        "rpm_limit": limits.get("rpm", 0),
                        "tpm_limit": limits.get("tpm", 0),
                        "rpd_limit": limits.get("rpd", 0),
                        "rpm_used": 0,
                        "tpm_used": 0,
                        "rpd_used": 0,
                    })
            
            self.models_cache = models
            self.models_cache_time = datetime.now()
            return models
            
        except Exception as e:
            print(f"Error fetching models: {e}")
            return []
    
    def record_usage(self, api_key: str, model: str, tokens: int):
        """Record API usage for rate limiting"""
        if api_key not in self.api_keys:
            return
        
        usage = self.api_keys[api_key]
        now = datetime.now()
        record = UsageRecord(timestamp=now, tokens=tokens, model=model)
        
        # Clean old records
        minute_ago = now - timedelta(minutes=1)
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        usage.requests_minute = [r for r in usage.requests_minute if r.timestamp > minute_ago]
        usage.requests_day = [r for r in usage.requests_day if r.timestamp > day_start]
        
        # Add new record
        usage.requests_minute.append(record)
        usage.requests_day.append(record)
        
        # Update totals
        usage.tokens_minute = sum(r.tokens for r in usage.requests_minute)
        usage.total_requests_today = len(usage.requests_day)
        usage.total_tokens_today = sum(r.tokens for r in usage.requests_day)
        
        self._save_usage()
    
    def get_usage_stats(self, api_key: str, model: str = None) -> Dict:
        """Get usage statistics for an API key"""
        if api_key not in self.api_keys:
            return {}
        
        usage = self.api_keys[api_key]
        now = datetime.now()
        minute_ago = now - timedelta(minutes=1)
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Filter by model if specified
        minute_records = [r for r in usage.requests_minute if r.timestamp > minute_ago]
        day_records = [r for r in usage.requests_day if r.timestamp > day_start]
        
        if model:
            minute_records = [r for r in minute_records if r.model == model]
            day_records = [r for r in day_records if r.model == model]
        
        return {
            "rpm": len(minute_records),
            "tpm": sum(r.tokens for r in minute_records),
            "rpd": len(day_records),
            "total_tokens_today": sum(r.tokens for r in day_records),
            "is_valid": usage.is_valid,
            "last_error": usage.last_error
        }
    
    def get_all_models_with_usage(self, api_key: str) -> List[Dict]:
        """Get all models with their current usage stats"""
        models = self.models_cache.copy()
        
        for model in models:
            stats = self.get_usage_stats(api_key, model["name"])
            model["rpm_used"] = stats.get("rpm", 0)
            model["tpm_used"] = stats.get("tpm", 0)
            model["rpd_used"] = stats.get("rpd", 0)
        
        return models
    
    def get_dashboard_data(self) -> Dict:
        """Get dashboard data for all keys"""
        keys_data = []
        for api_key, usage in self.api_keys.items():
            keys_data.append({
                "key_id": api_key[:8] + "..." + api_key[-4:],
                "key_preview": usage.key_preview,
                "is_valid": usage.is_valid,
                "requests_today": usage.total_requests_today,
                "tokens_today": usage.total_tokens_today,
                "last_error": usage.last_error
            })
        
        return {
            "keys": keys_data,
            "total_keys": len(self.api_keys),
            "models_count": len(self.models_cache),
            "last_models_update": self.models_cache_time.isoformat() if self.models_cache_time else None
        }

# Huggingface Client
class HuggingFaceClient:
    def __init__(self):
        self.api_keys: Dict[str, Dict] = {}
        self.usage_file = "huggingface_usage.json"
        self._load_usage()
    
    def _load_usage(self):
        try:
            if os.path.exists(self.usage_file):
                with open(self.usage_file, 'r') as f:
                    self.api_keys = json.load(f).get("keys", {})
        except:
            pass
    
    def _save_usage(self):
        try:
            with open(self.usage_file, 'w') as f:
                json.dump({"keys": self.api_keys}, f, indent=2)
        except:
            pass
    
    def add_api_key(self, token: str) -> bool:
        if not token or len(token) < 10:
            return False
        key_id = token[:8] + "..."
        self.api_keys[token] = {
            "preview": token[-4:],
            "is_valid": True,
            "requests_today": 0,
            "added_at": datetime.now().isoformat()
        }
        self._save_usage()
        return True
    
    async def validate_token(self, token: str) -> tuple[bool, str]:
        """Validate HuggingFace token"""
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                headers = {"Authorization": f"Bearer {token}"}
                async with session.get(
                    "https://huggingface.co/api/whoami",
                    headers=headers,
                    timeout=10
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return True, f"Valid - User: {data.get('name', 'Unknown')}"
                    return False, f"Invalid token (status {resp.status})"
        except Exception as e:
            return False, str(e)[:100]
    
    async def get_models(self, token: str, task: str = "text-generation") -> List[Dict]:
        """Get popular models from HuggingFace"""
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                headers = {"Authorization": f"Bearer {token}"}
                async with session.get(
                    f"https://huggingface.co/api/models?filter={task}&sort=downloads&limit=50",
                    headers=headers,
                    timeout=30
                ) as resp:
                    if resp.status == 200:
                        models = await resp.json()
                        return [{
                            "id": m.get("id", ""),
                            "name": m.get("id", "").split("/")[-1],
                            "downloads": m.get("downloads", 0),
                            "likes": m.get("likes", 0),
                            "pipeline_tag": m.get("pipeline_tag", "unknown")
                        } for m in models]
                    return []
        except Exception as e:
            print(f"Error fetching HF models: {e}")
            return []
    
    def get_dashboard_data(self) -> Dict:
        return {
            "keys": [
                {
                    "key_id": k[:8] + "...",
                    "preview": v.get("preview", "****"),
                    "is_valid": v.get("is_valid", True),
                    "requests_today": v.get("requests_today", 0)
                }
                for k, v in self.api_keys.items()
            ],
            "total_keys": len(self.api_keys)
        }

# Global instances
gemini_client = GeminiClient()
huggingface_client = HuggingFaceClient()
