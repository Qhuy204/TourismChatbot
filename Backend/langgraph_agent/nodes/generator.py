from typing import List, Dict

from ..state import MessageProcessingState, UserContextState, OutputState, EmotionType, IntentType
from ..utils.gemini_client import gemini_fast, gemini_pro
from ..utils.qwen_client import qwen_client
from .retriever import format_context_for_prompt
from .summarizer import build_context_prompt


# Emotion-based response styling
EMOTION_STYLES = {
    EmotionType.EXCITED: {
        "tone": "enthusiastic and energetic",
        "emoji": True,
        "length": "concise"
    },
    EmotionType.FRUSTRATED: {
        "tone": "empathetic and helpful",
        "emoji": False,
        "length": "clear and direct"
    },
    EmotionType.CURIOUS: {
        "tone": "informative and detailed",
        "emoji": False,
        "length": "comprehensive"
    },
    EmotionType.CALM: {
        "tone": "friendly and conversational",
        "emoji": True,
        "length": "balanced"
    },
    EmotionType.NEUTRAL: {
        "tone": "helpful and professional",
        "emoji": False,
        "length": "appropriate"
    },
}


def build_system_prompt(
    user_context: UserContextState,
    emotion: EmotionType,
    intent: IntentType
) -> str:
    """Build system prompt with user context and emotion styling"""
    style = EMOTION_STYLES.get(emotion, EMOTION_STYLES[EmotionType.NEUTRAL])
    
    # Base prompt
    prompt_parts = [
        "Bạn là trợ lý du lịch Việt Nam thân thiện và am hiểu.",
        "Nếu trong 'Thông tin tham khảo' có Image URL, hãy luôn ưu tiên nhúng ảnh vào câu trả lời bằng cú pháp Markdown: ![Mô tả](URL).",
        f"Phong cách trả lời: {style['tone']}.",
    ]
    
    # Add user preferences if available
    if user_context.preferred_cities:
        cities = ", ".join(user_context.preferred_cities[:3])
        prompt_parts.append(f"User thích: {cities}.")
    
    if user_context.travel_style:
        prompt_parts.append(f"Phong cách du lịch: {user_context.travel_style}.")
    
    if user_context.interests:
        interests = ", ".join(user_context.interests[:3])
        prompt_parts.append(f"Sở thích: {interests}.")
    
    # Intent-specific instructions
    if intent == IntentType.CHIT_CHAT:
        prompt_parts.append("Đây là chit-chat, hãy trả lời ngắn gọn và thân thiện.")
    elif intent == IntentType.NEGATIVE_FEEDBACK:
        prompt_parts.append("User đang không hài lòng, hãy xin lỗi và cải thiện.")
    
    # Emoji instruction
    if style['emoji']:
        prompt_parts.append("Có thể dùng emoji phù hợp.")
    
    return " ".join(prompt_parts)


async def generate_response(
    processing_state: MessageProcessingState,
    user_context: UserContextState,
    output_state: OutputState
) -> OutputState:
    """
    LangGraph node: Generate final response.
    Uses Gemini with context, emotion styling, and personalization.
    """
    # Build system prompt
    system_prompt = build_system_prompt(
        user_context=user_context,
        emotion=processing_state.emotion,
        intent=processing_state.intent
    )
    
    # Build conversation context
    conversation = build_context_prompt(
        message=processing_state.message,
        history=processing_state.recent_turns or processing_state.history,
        summary=processing_state.conversation_summary
    )
    
    # Add retrieved context
    rag_context = format_context_for_prompt(processing_state.retrieved_context)
    
    # Build final prompt
    prompt_parts = []
    
    if rag_context:
        prompt_parts.append(rag_context)
        prompt_parts.append("")
    
    prompt_parts.append("Hội thoại:")
    prompt_parts.append(conversation)
    prompt_parts.append("")
    prompt_parts.append("Trả lời (chi tiết, hữu ích):")
    
    final_prompt = "\n".join(prompt_parts)
    
    try:
        if processing_state.model_mode == "qwen":
            response_text = await qwen_client.generate(
                prompt=final_prompt,
                system_instruction=system_prompt,
                temperature=0.7,
                max_tokens=512
            )
            model_name = "qwen3-vl-8b-unsloth"
        else:
            # Choose model based on complexity
            use_pro = (
                len(processing_state.retrieved_context) > 3 or 
                len(processing_state.message) > 200
            )
            client = gemini_pro if use_pro else gemini_fast
            
            response_text = await client.generate(
                prompt=final_prompt,
                system_instruction=system_prompt,
                temperature=0.7,
                max_tokens=2000
            )
            model_name = client.model_name
        
        print(f"🤖 Model Used: {model_name} | Mode: {processing_state.model_mode}")
        
        output_state.response = response_text.strip()
        output_state.response_tone = EMOTION_STYLES.get(
            processing_state.emotion, 
            EMOTION_STYLES[EmotionType.NEUTRAL]
        )['tone']
        output_state.model_used = model_name
        
        # Add rich debug info
        output_state.debug_info = {
            "rewrite_method": processing_state.rewrite_method,
            "is_relevant": processing_state.is_relevant,
            "context_count": len(processing_state.retrieved_context),
            "model_used": model_name,
            "retrieved_sources": [
                {
                    "image_id": item.get("image_id", "N/A"),
                    "q": item.get("question", ""),
                    "a": item.get("answer", ""),
                    "image_url": item.get("image_url", ""),
                    "score": round(item.get("score", 0), 2)
                }
                for item in processing_state.retrieved_context
            ]
        }
        
    except Exception as e:
        print(f"Generation error: {e}")
        output_state.response = "Xin lỗi, tôi gặp lỗi khi xử lý. Bạn có thể thử lại không?"
        output_state.model_used = "error"
    
    return output_state
