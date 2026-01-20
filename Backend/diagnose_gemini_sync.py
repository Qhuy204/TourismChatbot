import os
from google import genai
from dotenv import load_dotenv

def diagnose_sync():
    load_dotenv()
    api_key = os.getenv("GEMINI_API_KEY")
    print(f"Key exists: {bool(api_key)}")
    
    client = genai.Client(api_key=api_key)
    
    # User requested model
    model = "gemini-3-flash-preview"
    
    print(f"\nTesting model (Sync): {model}...")
    try:
        # Using synchronous call to avoid aiohttp error
        response = client.models.generate_content(
            model=model,
            contents="Hello, say 'OK' if you see this."
        )
        print(f"✅ Success with {model}: {response.text}")
    except Exception as e:
        print(f"❌ Failed with {model}:")
        print(f"   Type: {type(e).__name__}")
        print(f"   Full error: {e}")

if __name__ == "__main__":
    diagnose_sync()
