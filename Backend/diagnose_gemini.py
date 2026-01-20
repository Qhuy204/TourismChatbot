import os
import asyncio
from google import genai
from dotenv import load_dotenv

async def diagnose():
    load_dotenv()
    api_key = os.getenv("GEMINI_API_KEY")
    print(f"Key exists: {bool(api_key)}")
    if api_key:
        print(f"Key starts with: {api_key[:5]}...")
    
    client = genai.Client(api_key=api_key)
    
    models = ["gemini-1.5-flash", "gemini-1.5-pro"]
    
    for model in models:
        print(f"\nTesting model: {model}...")
        try:
            response = await client.aio.models.generate_content(
                model=model,
                contents="Hello, say 'OK' if you see this."
            )
            print(f"✅ Success with {model}: {response.text}")
        except Exception as e:
            print(f"❌ Failed with {model}:")
            print(f"   Type: {type(e).__name__}")
            print(f"   Full error: {e}")

if __name__ == "__main__":
    asyncio.run(diagnose())
