"""
GPU Request Queue
Priority-based request queue for GPU inference with circuit breaker and fallback.
Designed for self-hosted Qwen model on RTX 3060.
"""
import asyncio
import time
from dataclasses import dataclass, field
from typing import Optional, Callable, Any
from enum import IntEnum
from collections import deque
from fastapi import HTTPException


class Priority(IntEnum):
    """Request priority levels"""
    LOW = 0       # Free users
    NORMAL = 1    # Regular users
    HIGH = 2      # API clients
    CRITICAL = 3  # Admin users


ROLE_PRIORITY = {
    "user": Priority.NORMAL,
    "api_client": Priority.HIGH,
    "admin": Priority.CRITICAL,
}


@dataclass(order=True)
class QueueItem:
    """A queued GPU inference request"""
    priority: int
    timestamp: float = field(compare=False)
    user_id: str = field(compare=False)
    request_data: dict = field(compare=False)
    future: asyncio.Future = field(compare=False, repr=False)


class CircuitBreaker:
    """
    Circuit breaker for GPU inference.
    Trips after consecutive failures, auto-recovers after cooldown.
    """
    def __init__(
        self,
        failure_threshold: int = 3,
        recovery_timeout: float = 30.0,
    ) -> None:
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self._failure_count = 0
        self._last_failure_time = 0.0
        self._state = "closed"  # closed (normal), open (tripped), half-open (testing)

    @property
    def is_open(self) -> bool:
        if self._state == "open":
            if time.time() - self._last_failure_time > self.recovery_timeout:
                self._state = "half-open"
                return False
            return True
        return False

    def record_success(self) -> None:
        self._failure_count = 0
        self._state = "closed"

    def record_failure(self) -> None:
        self._failure_count += 1
        self._last_failure_time = time.time()
        if self._failure_count >= self.failure_threshold:
            self._state = "open"
            print(f"⚡ Circuit breaker OPEN after {self._failure_count} failures. "
                  f"Recovery in {self.recovery_timeout}s")

    @property
    def state(self) -> str:
        # Check for auto-recovery
        if self._state == "open":
            _ = self.is_open  # Trigger state check
        return self._state


class PriorityLock:
    """Async lock that grants access to the highest priority waiter first."""
    def __init__(self):
        self._queue = []
        self._locked = False
        self._lock = asyncio.Lock()

    async def acquire(self, priority: int = 1):
        loop = asyncio.get_event_loop()
        future = loop.create_future()
        
        async with self._lock:
            if not self._locked:
                self._locked = True
                future.set_result(True)
            else:
                import heapq
                # negative priority for max-heap
                heapq.heappush(self._queue, (-priority, time.time(), future))
                
        await future

    async def release(self):
        async with self._lock:
            if self._queue:
                import heapq
                _, _, future = heapq.heappop(self._queue)
                future.set_result(True)
            else:
                self._locked = False

    @property
    def queue_size(self):
        return len(self._queue)


class GPUQueue:
    """
    Priority-based GPU queue manager using PriorityLock.
    Provides an async context manager for GPU requests.
    """
    def __init__(self, max_capacity: int = 200):
        self._priority_lock = PriorityLock()
        self._circuit_breaker = CircuitBreaker()
        self.max_capacity = max_capacity
        self._total_processed = 0
        self._total_failures = 0
        self._active_requests = 0

    @property
    def queue_size(self) -> int:
        return self._priority_lock.queue_size

    @property
    def active_requests(self) -> int:
        return self._active_requests

    @property
    def is_gpu_available(self) -> bool:
        return not self._circuit_breaker.is_open

    def get_stats(self) -> dict:
        return {
            "queue_size": self.queue_size,
            "active_requests": self.active_requests,
            "circuit_breaker_state": self._circuit_breaker.state,
            "total_processed": self._total_processed,
            "total_failures": self._total_failures,
            "is_gpu_available": self.is_gpu_available,
        }

    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def acquire(self, role: str = "user"):
        """
        Acquire the GPU lock based on priority.
        Yields True if acquired successfully, False if circuit breaker is open (fallback needed).
        """
        # 1. Check Maintenance Mode
        from langgraph_agent.utils.system_state import get_app_state
        state = get_app_state()
        
        if state == "MAINTENANCE" and role != "admin":
             raise HTTPException(
                status_code=503, 
                detail="System is currently under maintenance (Model Reloading). Please try again in a minute.", 
                headers={"Retry-After": "30"}
            )

        # 2. Reject if Queue is full (Max Capacity Overflow)
        if self.queue_size >= self.max_capacity:
            raise HTTPException(
                status_code=429, 
                detail="GPU Queue capacity (200) exceeded. Try again later.", 
                headers={"Retry-After": "30"}
            )
            
        if self._circuit_breaker.is_open:
            yield False
            return

        priority = ROLE_PRIORITY.get(role, Priority.NORMAL)
        
        # Add timeout to queue wait (e.g., 2 minutes)
        try:
            await asyncio.wait_for(self._priority_lock.acquire(priority), timeout=120.0)
        except asyncio.TimeoutError:
            self._total_failures += 1
            yield False
            return

        try:
            self._active_requests += 1
            yield True
            self._circuit_breaker.record_success()
            self._total_processed += 1
        except Exception as e:
            self._circuit_breaker.record_failure()
            self._total_failures += 1
            raise
        finally:
            self._active_requests = max(0, self._active_requests - 1)
            await self._priority_lock.release()

# Singleton instance
_gpu_queue: Optional[GPUQueue] = None

def get_gpu_queue() -> GPUQueue:
    global _gpu_queue
    if _gpu_queue is None:
        _gpu_queue = GPUQueue()
    return _gpu_queue
