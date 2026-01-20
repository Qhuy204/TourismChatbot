"""
Query Rewriter Node
Rewrites short/ambiguous queries using context
"""
from typing import List, Dict
import re

from ..state import MessageProcessingState
from ..utils.gemini_client import gemini_fast


# Short reply patterns for rule-based rewrite
SHORT_REPLIES = {
    "có": "Có, tôi muốn biết thêm về {topic}",
    "ok": "Đồng ý, cho tôi thêm thông tin về {topic}",
    "tiếp": "Tiếp tục về {topic}",
    "được": "Được, hãy cho tôi biết thêm về {topic}",
    "ừ": "Vâng, tôi quan tâm đến {topic}",
    "vâng": "Vâng, tôi muốn biết về {topic}",
    "đúng": "Đúng vậy, hãy nói thêm về {topic}",
    "thêm": "Cho tôi thêm thông tin về {topic}",
    "chi tiết": "Cho tôi chi tiết hơn về {topic}",
}

# Travel entities for detecting complete queries
TRAVEL_ENTITIES = [
    "hà nội", "sài gòn", "đà nẵng", "hội an", "huế", "nha trang",
    "phú quốc", "đà lạt", "sapa", "hạ long", "ninh bình", "quy nhơn",
    "khách sạn", "resort", "tour", "vé máy bay", "nhà hàng",
    "bãi biển", "núi", "chùa", "đền", "phố cổ", "viện bảo tàng"
]


def needs_rewrite(message: str) -> bool:
    """Check if message needs rewriting"""
    words = message.split()
    
    # Short confirmations don't need rewrite but need context
    if len(words) <= 2:
        return True
    
    # Already has travel entity - complete query
    message_lower = message.lower()
    for entity in TRAVEL_ENTITIES:
        if entity in message_lower:
            return False
    
    # Pronouns like "đó", "này" need context
    if any(p in message_lower for p in ["đó", "này", "nó", "ở đây"]):
        return True
    
    return False


def extract_last_topic(history: List[Dict]) -> str:
    """Extract the main topic from recent conversation"""
    if not history:
        return "chủ đề trước"
    
    # Look at last bot response
    for turn in reversed(history):
        if turn.get("role") == "assistant":
            content = turn.get("content", "")
            
            # Extract location names
            for entity in TRAVEL_ENTITIES:
                if entity in content.lower():
                    return entity.title()
            
            # Fallback: first 30 chars
            if len(content) > 30:
                return content[:30] + "..."
            return content
    
    return "chủ đề trước"


def rewrite_rule_based(message: str, history: List[Dict]) -> str:
    """Fast rule-based rewrite for simple cases"""
    message_lower = message.lower().strip()
    
    # Check short reply patterns
    if message_lower in SHORT_REPLIES:
        topic = extract_last_topic(history)
        return SHORT_REPLIES[message_lower].format(topic=topic)
    
    return message


async def rewrite_with_llm(message: str, history: List[Dict]) -> str:
    """LLM-based rewrite for complex cases"""
    # Format recent history
    recent = history[-3:] if len(history) > 3 else history
    context_lines = []
    for turn in recent:
        role = "User" if turn.get("role") == "user" else "Bot"
        content = turn.get("content", "")[:100]
        context_lines.append(f"{role}: {content}")
    
    context = "\n".join(context_lines)
    
    prompt = f"""Cải thiện câu hỏi người dùng để rõ ràng hơn dựa trên ngữ cảnh.

Ngữ cảnh hội thoại:
{context}

Câu hỏi hiện tại: "{message}"

Viết lại câu hỏi rõ ràng hơn (1 câu, giữ ý chính):"""
    
    try:
        rewritten = await gemini_fast.generate(
            prompt=prompt,
            system_instruction="Bạn là chuyên gia tối ưu câu lệnh tìm kiếm cho chatbot du lịch.",
            temperature=0.3,
            max_tokens=500
        )
        return rewritten.strip().strip('"').strip("'")
    except Exception:
        return message


async def rewrite_query(state: MessageProcessingState) -> MessageProcessingState:
    """
    LangGraph node: Rewrite query for better retrieval.
    Hybrid approach: rule-based first, LLM for complex cases.
    """
    if not needs_rewrite(state.message):
        state.rewritten_query = state.message
        state.rewrite_method = "skip"
        return state
    
    # Try rule-based first
    rewritten = rewrite_rule_based(state.message, state.history)
    
    if rewritten != state.message:
        state.rewritten_query = rewritten
        state.rewrite_method = "rule"
        return state
    
    # LLM for complex cases
    state.rewritten_query = await rewrite_with_llm(state.message, state.history)
    state.rewrite_method = "llm"
    
    return state
