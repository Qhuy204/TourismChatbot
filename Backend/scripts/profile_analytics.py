
import asyncio
import time
from langgraph_agent.memory.store import get_supabase

async def profile_query():
    client = get_supabase()
    if not client:
        print("❌ No supabase client")
        return

    print("🚀 Profiling Analytics Queries...")
    
    # Profile full context fetch
    start = time.time()
    res_full = client.table("chat_logs").select("context").limit(500).execute()
    end = time.time()
    full_size = len(str(res_full.data))
    print(f"📊 Full context (500 rows): {end - start:.2f}s, approx payload: {full_size / 1024:.1f} KB")

    # Profile field-only fetch
    start = time.time()
    res_field = client.table("chat_logs").select("context->>intent, context->>detected_location").limit(500).execute()
    end = time.time()
    field_size = len(str(res_field.data))
    print(f"⚡ Field-only (500 rows): {end - start:.2f}s, approx payload: {field_size / 1024:.1f} KB")

if __name__ == "__main__":
    asyncio.run(profile_query())
