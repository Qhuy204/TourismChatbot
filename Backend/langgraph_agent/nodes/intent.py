from typing import Tuple, List

from ..state import MessageProcessingState, IntentType
from ..utils.gemini_client import gemini_fast
from ..utils.qwen_client import qwen_client


import os
import yaml

# Initialize configs from YAML
_config_path = os.path.join(os.path.dirname(__file__), "..", "configs", "intent.yaml")
try:
    with open(_config_path, "r", encoding="utf-8") as f:
        _config = yaml.safe_load(f)
except Exception as e:
    print(f"⚠️ Error loading intent config: {e}")
    _config = {"intent_keywords": {}}

# Convert string mapping from YAML to Enum mapping
_raw_keywords = _config.get("intent_keywords", {})
INTENT_KEYWORDS = {
    IntentType(k): v for k, v in _raw_keywords.items()
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


async def classify_by_llm(message: str, history: List[dict] = None, model_mode: str = "gemini") -> IntentType:
    """LLM-based classification for ambiguous cases"""
    categories = [intent.value for intent in IntentType]
    
    context = ""
    if history and len(history) > 0:
        last_turn = history[-1].get("content", "")[:100]
        context = f"\nContext (tin nhắn trước): {last_turn}"
    
    if model_mode == "qwen":
        result = await qwen_client.classify(
            text=f"{message}{context}",
            categories=categories,
            system_instruction="Bạn là hệ thống phân loại intent cho chatbot du lịch Việt Nam."
        )
    else:
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
        intent = await classify_by_llm(
            message=state.message, 
            history=state.history,
            model_mode=state.model_mode
        )
        confidence = 0.8  # LLM confidence
    
    state.intent = intent
    state.intent_confidence = confidence
    
    return state
