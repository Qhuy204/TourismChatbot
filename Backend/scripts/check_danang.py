
import asyncio
from langgraph_agent.memory.store import get_supabase

async def check_danang():
    supabase = get_supabase()
    # Check for both 'location' and 'detected_location' just in case
    response = supabase.table("chat_logs").select("context").execute()
    data = response.data
    danang_count = 0
    total_with_loc = 0
    other_locs = {}
    
    for row in data:
        ctx = row.get("context")
        if ctx:
            loc = ctx.get("location") or ctx.get("detected_location")
            if loc:
                total_with_loc += 1
                if "Đà Nẵng" in loc or "Da Nang" in loc:
                    danang_count += 1
                else:
                    other_locs[loc] = other_locs.get(loc, 0) + 1
                    
    print(f"Total logs with location: {total_with_loc}")
    print(f"Đà Nẵng count: {danang_count}")
    print(f"Other locations: {other_locs}")

if __name__ == "__main__":
    asyncio.run(check_danang())
