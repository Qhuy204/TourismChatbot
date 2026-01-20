"""
Emotion Detection Node
Detects user emotions for response adaptation
"""
from typing import Tuple

from ..state import MessageProcessingState, EmotionType
from ..utils.gemini_client import gemini_fast


# Simple keyword-based emotion detection
EMOTION_KEYWORDS = {
    EmotionType.EXCITED: [
        "tuyệt vời", "tuyệt", "quá đẹp", "háo hức", "mong chờ",
        "thích quá", "wow", "amazing", "!!", "yay", "haha"
    ],
    EmotionType.FRUSTRATED: [
        "chán", "bực", "khó chịu", "tệ", "sai", "không hiểu",
        "lại", "mãi", "???", "zzz", "ugh"
    ],
    EmotionType.CURIOUS: [
        "tại sao", "vì sao", "như thế nào", "thế nào", "là gì",
        "ở đâu", "bao nhiêu", "khi nào", "?", "cho hỏi"
    ],
    EmotionType.CALM: [
        "ok", "được", "ừ", "vâng", "cảm ơn", "thanks",
        "tốt", "hay", "đẹp"
    ],
}


def detect_by_keywords(message: str) -> Tuple[EmotionType, float]:
    """Fast keyword-based emotion detection"""
    message_lower = message.lower()
    
    scores = {}
    for emotion, keywords in EMOTION_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in message_lower)
        if score > 0:
            scores[emotion] = score
    
    if not scores:
        return EmotionType.NEUTRAL, 0.7
    
    best_emotion = max(scores, key=scores.get)
    confidence = min(scores[best_emotion] / 2, 1.0)
    
    return best_emotion, confidence


async def detect_by_llm(message: str, history: list = None) -> EmotionType:
    """LLM-based emotion detection for nuanced cases"""
    context = ""
    if history and len(history) > 0:
        recent = history[-2:]
        context = "\n".join([f"{t.get('role')}: {t.get('content', '')[:50]}" for t in recent])
    
    prompt = f"""Phân tích emotion của user từ tin nhắn sau.

Tin nhắn: "{message}"
{f'Context: {context}' if context else ''}

Chọn MỘT trong: calm, excited, curious, frustrated, neutral
Chỉ trả về tên emotion:"""
    
    # Define system_instruction (assuming it's needed for the new parameter)
    system_instruction = "You are an emotion detection model. Your task is to identify the user's emotion from their message."

    try:
        response = await gemini_fast.generate(
            prompt,
            system_instruction=system_instruction,
            temperature=0.1,
            max_tokens=100
        )
        result = response.strip().lower() # Corrected from `result = result.strip().lower()` to use `response`
        
        # Map to enum
        for emotion in EmotionType:
            if emotion.value in result:
                return emotion
        
        return EmotionType.NEUTRAL
    except Exception:
        return EmotionType.NEUTRAL


async def detect_emotion(state: MessageProcessingState) -> MessageProcessingState:
    """
    LangGraph node: Detect user emotion.
    Hybrid approach: keywords first, LLM for low confidence.
    """
    # Try keyword-based first
    emotion, confidence = detect_by_keywords(state.message)
    
    # LLM fallback for low confidence
    if confidence < 0.6:
        emotion = await detect_by_llm(state.message, state.history)
        confidence = 0.8
    
    state.emotion = emotion
    state.emotion_confidence = confidence
    
    # Validate (prevent invalid values)
    if state.emotion not in EmotionType:
        state.emotion = EmotionType.NEUTRAL
    
    return state
