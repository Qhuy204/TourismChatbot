import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

def check_db():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    supabase = create_client(url, key)
    
    res = supabase.table("chat_sessions").select("id, user_id, title").limit(10).execute()
    for s in res.data:
        print(f"Session: {s['id']} | User: {s['user_id']} | Title: {s['title']}")

if __name__ == "__main__":
    check_db()
