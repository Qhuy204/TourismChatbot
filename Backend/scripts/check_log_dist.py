
import asyncio
import os
from langgraph_agent.memory.store import get_supabase

async def check_logs():
    supabase = get_supabase()
    response = supabase.table("chat_logs").select("context").execute()
    logs = response.data
    
    loc_counts = {}
    topic_counts = {}
    
    for log in logs:
        context = log.get("context")
        if not context:
            continue
        loc = context.get("detected_location")
        intent = context.get("intent")
        
        if loc:
            loc_counts[loc] = loc_counts.get(loc, 0) + 1
        if intent:
            topic_counts[intent] = topic_counts.get(intent, 0) + 1
            
    print("\n--- Raw Location Counts ---")
    for k, v in sorted(loc_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"{k}: {v}")
        
    print("\n--- Raw Topic Counts ---")
    for k, v in sorted(topic_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"{k}: {v}")

if __name__ == "__main__":
    asyncio.run(check_logs())
