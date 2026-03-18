
import asyncio
import time
from langgraph_agent.memory.store import get_location_analytics, get_topic_analytics

async def test_speed():
    print("🚀 Testing Optimized Analytics Functions...")
    
    start = time.time()
    loc_stats = await get_location_analytics(limit=10)
    end = time.time()
    print(f"📍 Location Analytics: {end - start:.2f}s")
    print(f"   Results: {len(loc_stats)}")

    start = time.time()
    topic_stats = await get_topic_analytics(limit=10)
    end = time.time()
    print(f"🧩 Topic Analytics: {end - start:.2f}s")
    print(f"   Results: {len(topic_stats)}")

if __name__ == "__main__":
    asyncio.run(test_speed())
