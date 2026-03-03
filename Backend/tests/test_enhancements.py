import pytest
import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env'))



class TestEvaluator:
    """Test evaluator.py functions"""
    
    def test_hallucination_score_empty_context(self):
        """Test hallucination score with no context"""
        from langgraph_agent.nodes.evaluator import compute_hallucination_score_heuristic
        
        score = compute_hallucination_score_heuristic("Đà Nẵng rất đẹp", [])
        assert score == 0.5  # Unknown when no context
    
    def test_hallucination_score_matching_context(self):
        """Test hallucination score when response matches context"""
        from langgraph_agent.nodes.evaluator import compute_hallucination_score_heuristic
        
        response = "Đà Nẵng có bãi biển Mỹ Khê rất đẹp"
        contexts = [
            {"question": "Đà Nẵng có gì đẹp?", "answer": "Bãi biển Mỹ Khê là một trong những bãi biển đẹp nhất"}
        ]
        
        score = compute_hallucination_score_heuristic(response, contexts)
        # Score should be low (< 0.5) because response matches context
        assert 0 <= score <= 1.0
        print(f"Hallucination score (matching): {score}")
    
    def test_hallucination_score_mismatched(self):
        """Test hallucination score when response doesn't match context"""
        from langgraph_agent.nodes.evaluator import compute_hallucination_score_heuristic
        
        response = "London có Big Ben và Tower Bridge"
        contexts = [
            {"question": "Đà Nẵng có gì đẹp?", "answer": "Bãi biển Mỹ Khê đẹp"}
        ]
        
        score = compute_hallucination_score_heuristic(response, contexts)
        # Score should be high (> 0.5) because response doesn't match
        assert 0 <= score <= 1.0
        print(f"Hallucination score (mismatched): {score}")



class TestLocationExtractor:
    """Test location_extractor.py functions"""
    
    def test_normalize_name(self):
        """Test name normalization for deduplication"""
        from langgraph_agent.nodes.location_extractor import normalize_name
        
        # Test Vietnamese character handling
        assert normalize_name("Phố cổ Hội An") == "pho co hoi an"
        assert normalize_name("Đà Nẵng") == "da nang"
        assert normalize_name("  Huế  ") == "hue"
        assert normalize_name("Đồng Nai") == "dong nai"
    
    @pytest.mark.asyncio
    async def test_extract_locations_basic(self):
        """Test location extraction from Vietnamese text"""
        from langgraph_agent.nodes.location_extractor import extract_locations
        
        text = "Bạn nên ghé thăm Phố cổ Hội An ở Quảng Nam và Bãi biển Mỹ Khê tại Đà Nẵng."
        locations = await extract_locations(text)
        
        print(f"Extracted {len(locations)} locations:")
        for loc in locations:
            print(f"  - {loc.name} ({loc.category})")
        
        # Should extract at least 1 location
        assert len(locations) >= 1
        
        # Check structure
        for loc in locations:
            assert loc.name
            assert loc.category in ["beach", "heritage", "nature", "food", "temple", "city", "mountain", "island", "museum", "other"]
    
    @pytest.mark.asyncio
    async def test_extract_locations_empty(self):
        """Test with text containing no locations"""
        from langgraph_agent.nodes.location_extractor import extract_locations
        
        text = "Xin chào, tôi có thể giúp gì cho bạn hôm nay?"
        locations = await extract_locations(text)
        
        assert len(locations) == 0
    
    @pytest.mark.asyncio
    async def test_extract_locations_short_text(self):
        """Test with very short text"""
        from langgraph_agent.nodes.location_extractor import extract_locations
        
        text = "Hi"
        locations = await extract_locations(text)
        
        assert len(locations) == 0



class TestEvaluationMetrics:
    """Test EvaluationMetrics dataclass"""
    
    def test_metrics_creation(self):
        """Test creating EvaluationMetrics"""
        from langgraph_agent.nodes.evaluator import EvaluationMetrics
        
        metrics = EvaluationMetrics(
            response_latency_ms=1500,
            context_relevance=0.85,
            context_count=3,
            model_used="gemini-2.5-flash",
            hallucination_score=0.2,
            response_length=150
        )
        
        assert metrics.response_latency_ms == 1500
        assert metrics.context_relevance == 0.85
        assert metrics.context_count == 3
        assert metrics.model_used == "gemini-2.5-flash"
        assert metrics.hallucination_score == 0.2
        assert metrics.response_length == 150



class TestExtractedLocation:
    """Test ExtractedLocation dataclass"""
    
    def test_location_creation(self):
        """Test creating ExtractedLocation"""
        from langgraph_agent.nodes.location_extractor import ExtractedLocation
        
        loc = ExtractedLocation(
            name="Phố cổ Hội An",
            city="Hội An",
            province="Quảng Nam",
            category="heritage",
            description="Phố cổ nổi tiếng"
        )
        
        assert loc.name == "Phố cổ Hội An"
        assert loc.city == "Hội An"
        assert loc.province == "Quảng Nam"
        assert loc.category == "heritage"
        assert loc.description == "Phố cổ nổi tiếng"



if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
