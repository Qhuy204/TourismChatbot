import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

def check_db():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("Missing Supabase credentials")
        return
    
    supabase = create_client(url, key)
    
    try:
        # Check sessions
        print("--- Chat Sessions ---")
        res = supabase.table("chat_sessions").select("*").limit(5).execute()
        print(f"Count: {len(res.data)}")
        for i, s in enumerate(res.data):
            print(f"{i}: {s.get('id')} - {s.get('title')}")
        
        # Check logs
        print("\n--- Chat Logs ---")
        res = supabase.table("chat_logs").select("*").limit(5).execute()
        print(f"Count: {len(res.data)}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_db()
