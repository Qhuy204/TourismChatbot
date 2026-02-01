from typing import Tuple

from ..state import MessageProcessingState, EmotionType
from ..utils.gemini_client import gemini_fast


import os
import yaml

# Initialize configs from YAML
_config_path = os.path.join(os.path.dirname(__file__), "..", "configs", "emotion.yaml")
try:
    with open(_config_path, "r", encoding="utf-8") as f:
        _config = yaml.safe_load(f)
except Exception as e:
    print(f"⚠️ Error loading emotion config: {e}")
    _config = {"emotion_keywords": {}}

# Convert string mapping from YAML to Enum mapping
_raw_keywords = _config.get("emotion_keywords", {})
EMOTION_KEYWORDS = {
    EmotionType(k): v for k, v in _raw_keywords.items()
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
