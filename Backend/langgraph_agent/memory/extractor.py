"""
Memory Extractor
Extracts long-term facts from user messages (preferences, personal info, constraints)
"""
from typing import List, Dict, Optional
from dataclasses import dataclass
from enum import Enum

from ..utils.gemini_client import gemini_fast


class FactType(str, Enum):
    """Types of extractable facts"""
    PREFERENCE = "preference"         # Likes/dislikes
    TRAVEL_STYLE = "travel_style"     # Adventure, relaxed, etc.
    CONSTRAINT = "constraint"         # Budget, time, health
    PERSONAL_INFO = "personal_info"   # Location, occupation
    INTEREST = "interest"             # Specific interests


@dataclass
class ExtractedFact:
    """A single extracted fact"""
    key: str
    value: str
    fact_type: FactType
    confidence: float
    source_message: str


# Rule-based patterns for common facts
FACT_PATTERNS = {
    # Preferences
    "thích": FactType.PREFERENCE,
    "yêu thích": FactType.PREFERENCE,
    "ưa thích": FactType.PREFERENCE,
    "ghét": FactType.PREFERENCE,
    "không thích": FactType.PREFERENCE,
    
    # Travel style
    "phong cách": FactType.TRAVEL_STYLE,
    "mạo hiểm": FactType.TRAVEL_STYLE,
    "thư giãn": FactType.TRAVEL_STYLE,
    "khám phá": FactType.TRAVEL_STYLE,
    
    # Constraints
    "ngân sách": FactType.CONSTRAINT,
    "budget": FactType.CONSTRAINT,
    "không có nhiều thời gian": FactType.CONSTRAINT,
    "dị ứng": FactType.CONSTRAINT,
    "ăn chay": FactType.CONSTRAINT,
    
    # Personal info
    "tôi sống ở": FactType.PERSONAL_INFO,
    "tôi ở": FactType.PERSONAL_INFO,
    "tôi là": FactType.PERSONAL_INFO,
    
    # Interests
    "quan tâm đến": FactType.INTEREST,
    "muốn tìm hiểu": FactType.INTEREST,
}

# Keys that can be stored
ALLOWED_KEYS = [
    "preferred_cities",
    "travel_style", 
    "budget_range",
    "dietary_restrictions",
    "interests",
    "disliked_places",
    "accommodation_preference",
    "transport_preference",
    "trip_duration_preference",
]


def extract_by_rules(message: str) -> List[ExtractedFact]:
    """Fast rule-based fact extraction"""
    message_lower = message.lower()
    facts = []
    
    for pattern, fact_type in FACT_PATTERNS.items():
        if pattern in message_lower:
            # Extract context around the pattern
            idx = message_lower.find(pattern)
            start = max(0, idx - 20)
            end = min(len(message), idx + len(pattern) + 50)
            context = message[start:end]
            
            # Simple key inference
            if fact_type == FactType.PREFERENCE:
                if "biển" in context.lower():
                    facts.append(ExtractedFact(
                        key="interests",
                        value="biển",
                        fact_type=fact_type,
                        confidence=0.7,
                        source_message=message[:100]
                    ))
                elif "núi" in context.lower():
                    facts.append(ExtractedFact(
                        key="interests",
                        value="núi",
                        fact_type=fact_type,
                        confidence=0.7,
                        source_message=message[:100]
                    ))
            elif fact_type == FactType.TRAVEL_STYLE:
                if "mạo hiểm" in context.lower() or "adventure" in context.lower():
                    facts.append(ExtractedFact(
                        key="travel_style",
                        value="adventure",
                        fact_type=fact_type,
                        confidence=0.8,
                        source_message=message[:100]
                    ))
                elif "thư giãn" in context.lower() or "relax" in context.lower():
                    facts.append(ExtractedFact(
                        key="travel_style",
                        value="relaxed",
                        fact_type=fact_type,
                        confidence=0.8,
                        source_message=message[:100]
                    ))
            elif fact_type == FactType.CONSTRAINT:
                if "ăn chay" in context.lower():
                    facts.append(ExtractedFact(
                        key="dietary_restrictions",
                        value="vegetarian",
                        fact_type=fact_type,
                        confidence=0.9,
                        source_message=message[:100]
                    ))
    
    return facts


async def extract_by_llm(message: str, history: List[Dict] = None) -> List[ExtractedFact]:
    """LLM-based extraction for complex cases"""
    # Only call LLM if message looks like it contains personal info
    indicators = ["tôi", "của tôi", "sở thích", "thích", "muốn", "cần"]
    if not any(ind in message.lower() for ind in indicators):
        return []
    
    prompt = f"""Phân tích tin nhắn và trích xuất thông tin cá nhân/sở thích của user.

Tin nhắn: "{message}"

Nếu có thông tin, trả về JSON array:
[{{"key": "interests/travel_style/budget_range/dietary_restrictions", "value": "...", "confidence": 0.0-1.0}}]

Nếu không có thông tin cá nhân, trả về: []

Chỉ trả về JSON:"""
    
    try:
        response = await gemini_fast.generate(
            prompt=prompt,
            temperature=0.2,
            max_tokens=200
        )
        
        import json
        import re
        
        # Try to parse JSON
        match = re.search(r'\[.*\]', response, re.DOTALL)
        if match:
            data = json.loads(match.group())
            facts = []
            for item in data:
                if item.get("key") in ALLOWED_KEYS:
                    facts.append(ExtractedFact(
                        key=item["key"],
                        value=item["value"],
                        fact_type=FactType.PREFERENCE,
                        confidence=float(item.get("confidence", 0.7)),
                        source_message=message[:100]
                    ))
            return facts
    except Exception:
        pass
    
    return []


async def extract_facts(message: str, history: List[Dict] = None) -> List[ExtractedFact]:
    """
    Main extraction function.
    Hybrid: rule-based first, LLM for additional facts.
    """
    facts = []
    
    # Rule-based extraction
    rule_facts = extract_by_rules(message)
    facts.extend(rule_facts)
    
    # LLM extraction if no rule-based facts found
    if not rule_facts:
        llm_facts = await extract_by_llm(message, history)
        facts.extend(llm_facts)
    
    return facts
