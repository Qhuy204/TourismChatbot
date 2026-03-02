import time
import psutil
from typing import Dict, Any

try:
    import GPUtil
except ImportError:
    GPUtil = None

class SmartCache:
    def __init__(self):
        self.cache = {}
        self.timestamps = {}
    
    def get(self, key: str, ttl_seconds: float) -> Any:
        if key in self.cache:
            if time.time() - self.timestamps[key] < ttl_seconds:
                return self.cache[key]
        return None
    
    def set(self, key: str, value: Any):
        self.cache[key] = value
        self.timestamps[key] = time.time()

# Global cache instance
cache = SmartCache()

def get_system_metrics() -> Dict[str, Any]:
    """Get hardware status with Tiered Caching strategy"""
    metrics = {}
    
    # 1. GPU (Cache 2.0s)
    gpu_stats = cache.get("gpu", 2.0)
    if not gpu_stats:
        if GPUtil:
            try:
                gpus = GPUtil.getGPUs()
                if gpus:
                    gpu = gpus[0]
                    gpu_stats = {
                        "utilization": round(gpu.load * 100, 1),
                        "memory_used": gpu.memoryUsed,
                        "memory_total": gpu.memoryTotal,
                        "temperature": gpu.temperature
                    }
                else:
                    gpu_stats = {"error": "No GPU found"}
            except Exception as e:
                gpu_stats = {"error": str(e)}
        else:
            gpu_stats = {"error": "GPUtil not installed"}
        cache.set("gpu", gpu_stats)
    metrics["gpu"] = gpu_stats

    # 2. CPU (Cache 3.0s)
    cpu_stats = cache.get("cpu", 3.0)
    if not cpu_stats:
        cpu_stats = {
            "utilization": psutil.cpu_percent(interval=None),
            "cores": psutil.cpu_count()
        }
        cache.set("cpu", cpu_stats)
    metrics["cpu"] = cpu_stats

    # 3. Memory/RAM (Cache 3.0s)
    ram_stats = cache.get("ram", 3.0)
    if not ram_stats:
        mem = psutil.virtual_memory()
        ram_stats = {
            "used": mem.used,
            "total": mem.total,
            "percent": mem.percent
        }
        cache.set("ram", ram_stats)
    metrics["ram"] = ram_stats

    # 4. Disk IO (Cache 10.0s)
    disk_stats = cache.get("disk", 10.0)
    if not disk_stats:
        disk = psutil.disk_usage('/')
        disk_stats = {
            "used": disk.used,
            "total": disk.total,
            "percent": disk.percent
        }
        cache.set("disk", disk_stats)
    metrics["disk"] = disk_stats

    return metrics
