import pytest
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from langgraph_agent.nodes.retriever import extract_location, boost_by_location

def test_extract_location():
    """Test location extraction using administrative manager"""
    # Test cases: (Input text, Expected normalized location)
    test_cases = [
        ("Kinh nghiệm đi chợ nổi Cái Răng Cần Thơ", "cai rang"),
        ("Tôi muốn đi Đà Lạt", "da lat"),
        ("Sapa có gì đẹp?", "sa pa"),
        ("Chào bạn!", None),
    ]
    
    for text, expected in test_cases:
        result = extract_location(text)
        print(f"Input: {text} | Extracted: {result} | Expected: {expected}")
        if expected:
            assert result == expected
        else:
            assert result is None

def test_boost_by_location():
    """Test score boosting logic"""
    import copy
    mock_results = [
        {
            "id": "1",
            "question": "Chợ nổi Cái Răng có gì?",
            "answer": "Chợ nổi Cái Răng rất nhộn nhịp",
            "score": 0.5
        },
        {
            "id": "2",
            "question": "Chợ nổi Long Xuyên ở đâu?",
            "answer": "Chợ nổi Long Xuyên ở An Giang",
            "score": 0.55
        },
        {
            "id": "3",
            "question": "Cách đi Cần Thơ?",
            "answer": "Cần Thơ có nhiều phương tiện",
            "score": 0.4
        }
    ]
    
    location = "cai rang"
    # Use deepcopy to avoid polluting follow-up tests
    test_data_1 = copy.deepcopy(mock_results)
    boosted = boost_by_location(test_data_1, location)
    
    # Sort and check ranking
    sorted_results = sorted(boosted, key=lambda x: x["score"], reverse=True)
    
    # Doc 1 should now be at the top because it matches "Cái Răng"
    assert sorted_results[0]["id"] == "1"
    assert round(sorted_results[0]["score"], 2) == 0.65
    assert sorted_results[0].get("boosted") is True
    
    # Check no boost if location is None
    test_data_2 = copy.deepcopy(mock_results)
    no_boost = boost_by_location(test_data_2, None)
    sorted_no_boost = sorted(no_boost, key=lambda x: x["score"], reverse=True)
    assert sorted_no_boost[0]["id"] == "2" # Doc 2 was original top score

if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
