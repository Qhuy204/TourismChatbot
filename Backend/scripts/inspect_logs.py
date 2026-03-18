
import asyncio
from langgraph_agent.memory.store import get_supabase

async def inspect_raw():
    supabase = get_supabase()
    response = supabase.table("chat_logs").select("context").limit(5).execute()
    print(response.data)

if __name__ == "__main__":
    asyncio.run(inspect_raw())
