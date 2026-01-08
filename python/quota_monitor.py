"""
API Quota and Memory Usage Monitoring Service
Monitors Huggingface API, Gemini API, and system memory
"""

import psutil
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Optional, Callable, List
from dataclasses import dataclass, field
from enum import Enum

class WarningLevel(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

@dataclass
class QuotaStatus:
    service: str
    used: int
    limit: int
    reset_at: Optional[datetime] = None
    level: WarningLevel = WarningLevel.INFO
    message: str = ""
    
    @property
    def percentage(self) -> float:
        if self.limit <= 0:
            return 0
        return (self.used / self.limit) * 100
    
    def to_dict(self) -> dict:
        return {
            "service": self.service,
            "used": self.used,
            "limit": self.limit,
            "percentage": round(self.percentage, 1),
            "reset_at": self.reset_at.isoformat() if self.reset_at else None,
            "level": self.level.value,
            "message": self.message
        }

@dataclass
class MemoryStatus:
    total_mb: float
    used_mb: float
    available_mb: float
    percent: float
    level: WarningLevel = WarningLevel.INFO
    message: str = ""
    
    def to_dict(self) -> dict:
        return {
            "total_mb": round(self.total_mb, 1),
            "used_mb": round(self.used_mb, 1),
            "available_mb": round(self.available_mb, 1),
            "percent": round(self.percent, 1),
            "level": self.level.value,
            "message": self.message
        }

@dataclass
class SystemWarning:
    timestamp: datetime
    level: WarningLevel
    source: str
    message: str
    details: Optional[dict] = None
    
    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp.isoformat(),
            "level": self.level.value,
            "source": self.source,
            "message": self.message,
            "details": self.details
        }

class QuotaMonitor:
    """Monitor API quotas and memory usage"""
    
    def __init__(self):
        # API quota tracking (simulated - in production, fetch from actual APIs)
        self.quotas: Dict[str, QuotaStatus] = {
            "huggingface": QuotaStatus(
                service="huggingface",
                used=0,
                limit=1000,  # requests per hour
                reset_at=datetime.now() + timedelta(hours=1)
            ),
            "gemini": QuotaStatus(
                service="gemini",
                used=0,
                limit=60,  # requests per minute for free tier
                reset_at=datetime.now() + timedelta(minutes=1)
            )
        }
        
        # Warning thresholds
        self.warning_threshold = 80  # 80% usage triggers warning
        self.critical_threshold = 95  # 95% usage triggers critical
        
        # Warning history
        self.warnings: List[SystemWarning] = []
        self.max_warnings = 100
        
        # Callbacks
        self.on_warning: Optional[Callable[[SystemWarning], None]] = None
    
    def get_memory_status(self) -> MemoryStatus:
        """Get current memory status"""
        mem = psutil.virtual_memory()
        
        status = MemoryStatus(
            total_mb=mem.total / (1024 * 1024),
            used_mb=mem.used / (1024 * 1024),
            available_mb=mem.available / (1024 * 1024),
            percent=mem.percent
        )
        
        # Set warning level
        if mem.percent >= self.critical_threshold:
            status.level = WarningLevel.CRITICAL
            status.message = f"CRITICAL: Memory usage at {mem.percent:.1f}%! Risk of crash."
        elif mem.percent >= self.warning_threshold:
            status.level = WarningLevel.WARNING
            status.message = f"WARNING: Memory usage at {mem.percent:.1f}%"
        else:
            status.level = WarningLevel.INFO
            status.message = "Memory usage normal"
        
        return status
    
    def update_quota(self, service: str, requests_made: int = 1):
        """Update quota usage for a service"""
        if service not in self.quotas:
            return
        
        quota = self.quotas[service]
        
        # Check if quota should reset
        if quota.reset_at and datetime.now() >= quota.reset_at:
            quota.used = 0
            if service == "gemini":
                quota.reset_at = datetime.now() + timedelta(minutes=1)
            else:
                quota.reset_at = datetime.now() + timedelta(hours=1)
        
        # Update usage
        quota.used += requests_made
        
        # Set warning level
        pct = quota.percentage
        if pct >= self.critical_threshold:
            quota.level = WarningLevel.CRITICAL
            quota.message = f"CRITICAL: {service} quota at {pct:.1f}%! API calls may fail."
            self._add_warning(WarningLevel.CRITICAL, service, quota.message)
        elif pct >= self.warning_threshold:
            quota.level = WarningLevel.WARNING
            quota.message = f"WARNING: {service} quota at {pct:.1f}%"
            self._add_warning(WarningLevel.WARNING, service, quota.message)
        elif pct >= 100:
            quota.level = WarningLevel.ERROR
            quota.message = f"ERROR: {service} quota exceeded! Requests will fail."
            self._add_warning(WarningLevel.ERROR, service, quota.message)
        else:
            quota.level = WarningLevel.INFO
            quota.message = "Quota usage normal"
    
    def get_quota_status(self, service: str) -> Optional[QuotaStatus]:
        """Get quota status for a service"""
        return self.quotas.get(service)
    
    def get_all_status(self) -> dict:
        """Get all status information"""
        return {
            "memory": self.get_memory_status().to_dict(),
            "quotas": {k: v.to_dict() for k, v in self.quotas.items()},
            "warnings": [w.to_dict() for w in self.warnings[-10:]]  # Last 10 warnings
        }
    
    def _add_warning(self, level: WarningLevel, source: str, message: str, details: dict = None):
        """Add a warning to history"""
        warning = SystemWarning(
            timestamp=datetime.now(),
            level=level,
            source=source,
            message=message,
            details=details
        )
        
        self.warnings.append(warning)
        
        # Trim history
        if len(self.warnings) > self.max_warnings:
            self.warnings = self.warnings[-self.max_warnings:]
        
        # Trigger callback
        if self.on_warning:
            self.on_warning(warning)
    
    def check_can_proceed(self, service: str) -> tuple[bool, str]:
        """Check if we can proceed with API call"""
        quota = self.quotas.get(service)
        if not quota:
            return True, "Unknown service"
        
        if quota.used >= quota.limit:
            time_left = ""
            if quota.reset_at:
                delta = quota.reset_at - datetime.now()
                if delta.total_seconds() > 0:
                    mins = int(delta.total_seconds() / 60)
                    time_left = f" Resets in {mins} minutes."
            return False, f"{service} quota exceeded.{time_left}"
        
        return True, "OK"
    
    def reset_quota(self, service: str):
        """Manually reset quota for a service"""
        if service in self.quotas:
            self.quotas[service].used = 0
            self.quotas[service].level = WarningLevel.INFO
            self.quotas[service].message = "Quota reset"

# Global instance
quota_monitor = QuotaMonitor()
