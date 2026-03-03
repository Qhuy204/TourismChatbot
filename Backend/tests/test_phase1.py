import pytest
import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env'))



class TestStateObjects:
    """Test state.py dataclasses"""
    
    def test_user_context_state_creation(self):
        """Test UserContextState initialization"""
        from langgraph_agent.state import UserContextState
        
        state = UserContextState(
            user_id="user123",
            session_id="session456"
        )
        
        assert state.user_id == "user123"
        assert state.session_id == "session456"
        assert state.preferred_cities == []
        assert state.travel_style == ""
    
    def test_user_context_cache_validity(self):
        """Test cache validity check"""
        from langgraph_agent.state import UserContextState
        import time
        
        state = UserContextState(
            user_id="user123",
            session_id="session456",
            cached_at=time.time()
        )
        
        # Cache should be valid
        assert state.is_cache_valid(ttl_seconds=60) == True
        
        # Expired cache
        state.cached_at = time.time() - 3600  # 1 hour ago
        assert state.is_cache_valid(ttl_seconds=1800) == False
    
    def test_message_processing_state_creation(self):
        """Test MessageProcessingState initialization"""
        from langgraph_agent.state import MessageProcessingState, IntentType, EmotionType
        
        state = MessageProcessingState(
            message="Tôi muốn đi Đà Nẵng",
            history=[]
        )
        
        assert state.message == "Tôi muốn đi Đà Nẵng"
        assert state.intent == IntentType.TRAVEL_QUERY
        assert state.emotion == EmotionType.NEUTRAL
        assert state.is_relevant == True
    
    def test_output_state_creation(self):
        """Test OutputState initialization"""
        from langgraph_agent.state import OutputState
        
        state = OutputState()
        
        assert state.response == ""
        assert state.suggested_prompts == []
        assert state.memory_updated == False
    
    def test_agent_state_factory(self):
        """Test AgentState.create() factory method"""
        from langgraph_agent.state import AgentState
        
        state = AgentState.create(
            user_id="user123",
            session_id="session456",
            message="Xin chào!",
            history=[{"role": "user", "content": "Hi"}]
        )
        
        assert state.user_context.user_id == "user123"
        assert state.processing.message == "Xin chào!"
        assert len(state.processing.history) == 1
        assert state.output.response == ""



class TestGeminiClient:
    """Test gemini_client.py"""
    
    def test_gemini_client_initialization(self):
        """Test GeminiClient can be instantiated"""
        from langgraph_agent.utils.gemini_client import GeminiClient, TEXT_MODEL
        
        client = GeminiClient(TEXT_MODEL)
        assert client.model_name == TEXT_MODEL
    
    @pytest.mark.asyncio
    async def test_gemini_connection(self):
        """Test actual Gemini API connection"""
        from langgraph_agent.utils.gemini_client import test_connection
        
        result = await test_connection()
        assert result == True, "Gemini API connection failed - check GEMINI_API_KEY"
    
    @pytest.mark.asyncio
    async def test_gemini_generate(self):
        """Test basic text generation"""
        from langgraph_agent.utils.gemini_client import gemini_fast
        
        response = await gemini_fast.generate(
            prompt="Nói 'xin chào' bằng tiếng Việt",
            max_tokens=20
        )
        
        assert len(response) > 0
        print(f"Gemini response: {response}")
    
    @pytest.mark.asyncio
    async def test_gemini_classify(self):
        """Test classification helper"""
        from langgraph_agent.utils.gemini_client import gemini_fast
        
        categories = ["travel_query", "chit_chat", "other"]
        
        # Should classify as travel_query
        result = await gemini_fast.classify(
            text="Tôi muốn đi du lịch Đà Nẵng",
            categories=categories
        )
        
        assert result in categories
        print(f"Classification result: {result}")
    
    @pytest.mark.asyncio
    async def test_gemini_generate_json(self):
        """Test JSON structured output"""
        from langgraph_agent.utils.gemini_client import gemini_fast
        
        schema = {
            "emotion": "string (positive|negative|surprise|neutral)",
            "confidence": "float 0-1"
        }
        
        result = await gemini_fast.generate_json(
            prompt="Phân tích emotion của câu: 'Tôi rất vui vì được đi du lịch!'",
            schema=schema
        )
        
        assert "emotion" in result or "confidence" in result
        print(f"JSON result: {result}")



if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
