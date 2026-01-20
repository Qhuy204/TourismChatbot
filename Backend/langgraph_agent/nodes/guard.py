"""
Relevance Guard Node
Filters off-topic queries before RAG retrieval
"""
from ..state import MessageProcessingState, IntentType
from ..utils.gemini_client import gemini_fast


# Keywords indicating travel-related queries
TRAVEL_KEYWORDS = [
    "du lịch", "địa điểm", "thăm", "tham quan", "khám phá",
    "khách sạn", "resort", "homestay", "ở đâu", "nghỉ",
    "ăn gì", "món ngon", "đặc sản", "quán", "nhà hàng",
    "đi", "bay", "xe", "tàu", "tour", "vé",
    "biển", "núi", "đảo", "phố", "chùa", "đền", "viện",
    "việt nam", "hà nội", "sài gòn", "đà nẵng", "hội an"
]

# Off-topic patterns
OFF_TOPIC_PATTERNS = [
    "code", "lập trình", "python", "javascript",
    "toán", "tính", "giải", "phương trình",
    "chính trị", "bầu cử", "tôn giáo",
    "y tế", "bệnh", "thuốc", "khám"
]


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
    # Skip for chit_chat - always relevant (no RAG needed)
    if state.intent == IntentType.CHIT_CHAT:
        state.is_relevant = True
        state.relevance_reason = "chit_chat_always_relevant"
        return state
    
    # Keyword-based check
    is_relevant, reason = check_relevance_keywords(state.rewritten_query or state.message)
    
    # LLM check for ambiguous cases
    if reason == "no_strong_signal":
        is_relevant, reason = await check_relevance_llm(state.rewritten_query or state.message)
    
    state.is_relevant = is_relevant
    state.relevance_reason = reason
    
    return state
