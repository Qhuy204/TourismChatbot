"""
Relevance Guard Node
Filters off-topic queries before RAG retrieval
"""
from ..state import MessageProcessingState, IntentType
from ..utils.gemini_client import gemini_fast


import os
import yaml

# Initialize configs from YAML
_config_path = os.path.join(os.path.dirname(__file__), "..", "configs", "guard.yaml")
try:
    with open(_config_path, "r", encoding="utf-8") as f:
        _config = yaml.safe_load(f)
except Exception as e:
    print(f"⚠️ Error loading guard config: {e}")
    _config = {"travel_keywords": [], "off_topic_patterns": []}

TRAVEL_KEYWORDS = _config.get("travel_keywords", [])
OFF_TOPIC_PATTERNS = _config.get("off_topic_patterns", [])


def check_relevance_keywords(message: str) -> tuple[bool, str]:
    """Fast keyword-based relevance check"""
    message_lower = message.lower()
    
    # Check for travel keywords
    has_travel = any(kw in message_lower for kw in TRAVEL_KEYWORDS)
    
    # Check for off-topic patterns
    has_offtopic = any(kw in message_lower for kw in OFF_TOPIC_PATTERNS)
    
    if has_offtopic and not has_travel:
        return False, "off_topic_detected"
    
    if has_travel:
        return True, "travel_keywords_found"
    
    # Ambiguous - could be relevant
    return True, "no_strong_signal"


async def check_relevance_llm(message: str) -> tuple[bool, str]:
    """LLM-based relevance check for ambiguous cases"""
    prompt = f"""Câu hỏi này có liên quan đến du lịch Việt Nam không?

Câu hỏi: "{message}"

Trả lời chỉ YES hoặc NO:"""
    
    try:
        result = await gemini_fast.generate(
            prompt=prompt,
            temperature=0.1,
            max_tokens=100
        )
        
        is_relevant = "yes" in result.lower()
        reason = "llm_relevant" if is_relevant else "llm_off_topic"
        return is_relevant, reason
    except Exception:
        # Default to relevant on error
        return True, "llm_error_default_relevant"


async def check_relevance(state: MessageProcessingState) -> MessageProcessingState:
    """
    LangGraph node: Check if query is relevant to tourism domain.
    Prevents off-topic queries from using RAG.
    """
    # Skip for simple intents - always relevant (no RAG needed)
    if state.intent in [IntentType.CHIT_CHAT, IntentType.NEGATIVE_FEEDBACK, IntentType.META_INSTRUCTION]:
        state.is_relevant = True
        state.relevance_reason = "simple_intent_always_relevant"
        return state
    
    # Keyword-based check
    is_relevant, reason = check_relevance_keywords(state.rewritten_query or state.message)
    
    # LLM check for ambiguous cases
    if reason == "no_strong_signal":
        is_relevant, reason = await check_relevance_llm(state.rewritten_query or state.message)
    
    state.is_relevant = is_relevant
    state.relevance_reason = reason
    
    return state
