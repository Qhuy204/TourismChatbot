import asyncio
import os
import sys
import traceback

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

async def test_minimal():
    from langgraph_agent.utils.gemini_client import gemini_fast
    print("🚀 Direct Gemini Test Started")
    print(f"DEBUG: Using model {gemini_fast.model_name}")
    
    prompt = "Trích xuất địa điểm: Đà Lạt có thác Cam Ly."
    schema = {"locations": "array of objects"}
    
    try:
        print("🔗 Calling generate_json...")
        result = await gemini_fast.generate_json(prompt, schema=schema)
        print(f"✅ Result: {result}")
    except Exception as e:
        print(f"❌ Error in generate_json ({type(e).__name__}): {e}")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_minimal())
