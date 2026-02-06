"""
Conversation Summarizer Node
Manages short-term context by summarizing older conversation turns
"""
from typing import List, Dict

from ..state import MessageProcessingState
from ..utils.gemini_client import gemini_fast
from ..utils.qwen_client import qwen_client


# Configuration
MAX_RAW_TURNS = 6       
SUMMARY_THRESHOLD = 12  


async def summarize_conversation(history: List[Dict], model_mode: str = "gemini") -> str:
    """
    Summarize older conversation turns.
    Only called when history > SUMMARY_THRESHOLD
    """
    if len(history) <= MAX_RAW_TURNS:
        return ""
    
    # Get turns to summarize (excluding recent ones)
    older_turns = history[:-MAX_RAW_TURNS]
    
    # Format turns for summarization
    formatted = []
    for turn in older_turns:
        role = "User" if turn.get("role") == "user" else "Bot"
        content = turn.get("content", "")[:200]  # Truncate long messages
        formatted.append(f"{role}: {content}")
    
    turns_text = "\n".join(formatted)
    
    prompt = f"""Tóm tắt ngắn gọn cuộc hội thoại sau (giữ lại thông tin quan trọng về sở thích, địa điểm du lịch):{turns_text} Tóm tắt (2-3 câu):"""
    
    try:
        if model_mode == "qwen":
            summary = await qwen_client.generate(
                prompt=prompt,
                system_instruction="Bạn là chuyên gia tóm tắt hội thoại.",
                temperature=0.3,
                max_tokens=1000
            )
        else:
            summary = await gemini_fast.generate(
                prompt=prompt,
                system_instruction="Bạn là chuyên gia tóm tắt hội thoại.",
                temperature=0.3,
                max_tokens=1000
            )
        return summary.strip()
    except Exception as e:
        print(f"Summarization failed: {e}")
        return ""


def build_context_prompt(
    message: str,
    history: List[Dict],
    summary: str = ""
) -> str:
    """
    Build optimized context for LLM prompt.
    Uses summary + recent turns instead of full history.
    """
    context_parts = []
    
    # 1. Summary of older turns (if exists)
    if summary:
        context_parts.append(f"[Tóm tắt hội thoại trước]: {summary}")
        context_parts.append("")
    
    # 2. Recent turns (raw)
    recent = history[-MAX_RAW_TURNS:] if len(history) > MAX_RAW_TURNS else history
    for turn in recent:
        role = "User" if turn.get("role") == "user" else "Bot"
        context_parts.append(f"{role}: {turn.get('content', '')}")
    
    # 3. Current message
    context_parts.append(f"User: {message}")
    
    return "\n".join(context_parts)


async def prepare_context(state: MessageProcessingState) -> MessageProcessingState:
    """
    LangGraph node: Prepare context with summarization.
    Called BEFORE main processing.
    """
    # Check if summarization needed
    if len(state.history) > SUMMARY_THRESHOLD and not state.conversation_summary:
        state.conversation_summary = await summarize_conversation(
            state.history, 
            model_mode=state.model_mode
        )
    
    # Split history
    if len(state.history) > MAX_RAW_TURNS:
        state.recent_turns = state.history[-MAX_RAW_TURNS:]
    else:
        state.recent_turns = state.history
    
    return state
