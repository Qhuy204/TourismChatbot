from typing import Tuple, List

from ..state import MessageProcessingState, IntentType
from ..utils.gemini_client import gemini_fast


# Keyword-based rules for fast classification
INTENT_KEYWORDS = {
    IntentType.TRAVEL_QUERY: [
        "đi", "du lịch", "địa điểm", "khách sạn", "tour", "vé",
        "thăm", "tham quan", "nghỉ dưỡng", "resort", "bãi biển",
        "núi", "đảo", "phố cổ", "chùa", "đền", "lăng", "viện bảo tàng",
        "ăn gì", "món ngon", "đặc sản", "ẩm thực", "nhà hàng",
        "lịch trình", "itinerary", "ngày", "đêm"
    ],
    IntentType.CHIT_CHAT: [
        "bạn là ai", "xin chào", "tạm biệt", "cảm ơn", "hello", "hi",
        "tên gì", "làm gì", "giúp gì", "bye", "goodbye"
    ],
    IntentType.PREFERENCE_UPDATE: [
        "cập nhật sở thích", "thích đi", "không thích", "yêu thích",
        "ưa thích", "ghét", "muốn", "prefer", "sở thích của tôi"
    ],
    IntentType.NEGATIVE_FEEDBACK: [
        "sai rồi", "không đúng", "nhầm", "không phải", "chán",
        "tệ", "dở", "không hài lòng", "thất vọng"
    ],
}


def classify_by_keywords(message: str) -> Tuple[IntentType, float]:
    """Fast keyword-based classification"""
    message_lower = message.lower()
    
    scores = {}
    for intent, keywords in INTENT_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in message_lower)
        if score > 0:
            scores[intent] = score
    
    if not scores:
        return IntentType.TRAVEL_QUERY, 0.5  # Default with low confidence
    
    best_intent = max(scores, key=scores.get)
    # Normalize confidence (max 3 keywords = high confidence)
    confidence = min(scores[best_intent] / 3, 1.0)
    
    return best_intent, confidence


async def classify_by_llm(message: str, history: List[dict] = None) -> IntentType:
    """LLM-based classification for ambiguous cases"""
    categories = [intent.value for intent in IntentType]
    
    context = ""
    if history and len(history) > 0:
        last_turn = history[-1].get("content", "")[:100]
        context = f"\nContext (tin nhắn trước): {last_turn}"
    
    result = await gemini_fast.classify(
        text=f"{message}{context}",
        categories=categories,
        system_instruction="Bạn là hệ thống phân loại intent cho chatbot du lịch Việt Nam."
    )
    
    # Map string back to enum
    for intent in IntentType:
        if intent.value == result:
            return intent
    
    return IntentType.TRAVEL_QUERY


async def classify_intent(state: MessageProcessingState) -> MessageProcessingState:
    """
    LangGraph node: Classify user intent.
    Uses hybrid approach: keywords first, LLM for low confidence.
    """
    # Try keyword-based first
    intent, confidence = classify_by_keywords(state.message)
    
    # LLM fallback for low confidence
    if confidence < 0.6:
        intent = await classify_by_llm(state.message, state.history)
        confidence = 0.8  # LLM confidence
    
    state.intent = intent
    state.intent_confidence = confidence
    
    return state
