"""
Quick test script for Phase 1 modules
Run: python test_quick.py
"""
import asyncio
import os
import sys

# Setup path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))


async def main():
    print("=" * 50)
    print("Phase 1: Core Foundation - Quick Tests")
    print("=" * 50)
    
    # Test 1: State objects
    print("\n✅ Test 1: State Objects")
    try:
        from langgraph_agent.state import AgentState, IntentType, EmotionType
        
        state = AgentState.create(
            user_id="test_user",
            session_id="test_session",
            message="Tôi muốn đi du lịch Đà Nẵng"
        )
        
        print(f"  - user_id: {state.user_context.user_id}")
        print(f"  - message: {state.processing.message}")
        print(f"  - intent: {state.processing.intent}")
        print(f"  - emotion: {state.processing.emotion}")
        print("  ✅ State objects OK!")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Test 2: Gemini Client initialization
    print("\n✅ Test 2: Gemini Client Init")
    try:
        from langgraph_agent.utils.gemini_client import GeminiClient, TEXT_MODEL
        
        client = GeminiClient(TEXT_MODEL)
        print(f"  - Model: {client.model_name}")
        print("  ✅ Client initialized!")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Test 3: Gemini API call
    print("\n✅ Test 3: Gemini API Call")
    api_key = os.getenv("GEMINI_API_KEY", "")
    print(f"  - API Key present: {len(api_key) > 10}")
    print(f"  - API Key prefix: {api_key[:10]}..." if len(api_key) > 10 else "  - No API key!")
    
    if len(api_key) > 10 and api_key != "YOUR_GEMINI_API_KEY_HERE":
        try:
            from langgraph_agent.utils.gemini_client import gemini_fast
            
            response = await gemini_fast.generate(
                prompt="Trả lời ngắn gọn: 1+1=?",
                max_tokens=10
            )
            print(f"  - Response: {response.strip()}")
            print("  ✅ Gemini API working!")
        except Exception as e:
            print(f"  ❌ API Error: {e}")
    else:
        print("  ⚠️ Skipped - No valid API key")
    
    # Test 4: Classify
    print("\n✅ Test 4: Gemini Classification")
    if len(api_key) > 10 and api_key != "YOUR_GEMINI_API_KEY_HERE":
        try:
            from langgraph_agent.utils.gemini_client import gemini_fast
            
            result = await gemini_fast.classify(
                text="Tôi muốn đi biển Đà Nẵng",
                categories=["travel_query", "chit_chat", "other"]
            )
            print(f"  - Classification: {result}")
            print("  ✅ Classification working!")
        except Exception as e:
            print(f"  ❌ Error: {e}")
    else:
        print("  ⚠️ Skipped - No valid API key")
    
    print("\n" + "=" * 50)
    print("Tests completed!")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
