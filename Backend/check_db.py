import os
import asyncio
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

async def check_db():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("Missing Supabase credentials")
        return
    
    supabase = create_client(url, key)
    
    # Check sessions
    print("--- Chat Sessions ---")
    res = supabase.table("chat_sessions").select("*").limit(5).execute()
    print(res.data)
    
    # Check logs
    print("\n--- Chat Logs ---")
    res = supabase.table("chat_logs").select("*").limit(5).execute()
    print(res.data)

if __name__ == "__main__":
    asyncio.run(check_db())
