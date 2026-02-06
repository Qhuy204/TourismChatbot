"""
Verification script for Qwen3 VL 8B mode integration.
"""
import asyncio
import os
import sys

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

async def verify_qwen_integration():
    from langgraph_agent.utils.qwen_client import qwen_client, test_qwen_connection
    from langgraph_agent.graph import run_graph
    
    print("Step 1: Testing QwenClient connection...")
    is_connected = await test_qwen_connection()
    if is_connected:
        print("✅ QwenClient connection successful")
    else:
        print("❌ QwenClient connection failed")
        return

    print("\nStep 2: Testing Full Graph in Qwen mode...")
    # Use valid UUID formats to avoid Supabase errors
    user_id = "0f395a14-2801-42b6-9e6d-827de8d3efc0"
    session_id = "0f395a14-2801-42b6-9e6d-827de8d3efc0"
    message = "Vịnh Lăng Cô có gì đặc biệt?"
    history = []
    
    try:
        result = await run_graph(
            user_id=user_id,
            session_id=session_id,
            message=message,
            history=history,
            model_mode="qwen"
        )
        
        print("\n--- Graph Response (Qwen Mode) ---")
        print(f"Response: {result.get('response')[:200]}...")
        print(f"Model Used: {result.get('debug', {}).get('model_used')}")
        print(f"Intent: {result.get('intent')}")
        print(f"Emotion: {result.get('emotion_detected')}")
        print(f"Suggestions: {[s['text'] for s in result.get('suggested_prompts', [])]}")
        
        if result.get('debug', {}).get('model_used') == "qwen3-vl-8b-unsloth":
            print("\n✅ Verification SUCCESS: Qwen mode is active and working!")
        else:
            print(f"\n❌ Verification FAILED: Unexpected model used: {result.get('debug', {}).get('model_used')}")
            
    except Exception as e:
        print(f"\n❌ Verification ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(verify_qwen_integration())
