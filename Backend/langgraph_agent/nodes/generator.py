from typing import List, Dict

from ..state import MessageProcessingState, UserContextState, OutputState, EmotionType, IntentType
from ..utils.gemini_client import gemini_fast, gemini_pro
from ..utils.llama_client import llama_client
from ..utils.system_state import get_use_llama
from utils.config_manager import config
from .retriever import format_context_for_prompt
from .summarizer import build_context_prompt


# Emotion-based response styling
EMOTION_STYLES = {
    EmotionType.POSITIVE: {
        "tone": "enthusiastic and friendly",
        "emoji": True,
        "length": "concise"
    },
    EmotionType.NEGATIVE: {
        "tone": "empathetic and helpful",
        "emoji": False,
        "length": "clear and direct"
    },
    EmotionType.SURPRISE: {
        "tone": "informative and engaging",
        "emoji": True,
        "length": "comprehensive"
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
    intent: IntentType,
    language: str = "vi"
) -> str:
    """Build system prompt with user context and emotion styling"""
    style = EMOTION_STYLES.get(emotion, EMOTION_STYLES[EmotionType.NEUTRAL])
    
    # Base prompt based on language
    base_prompts = {
        "vi": [
            "Bạn là trợ lý du lịch Việt Nam thân thiện và am hiểu.",
            "Hãy trả lời bằng tiếng Việt.",
            "CHỈ nhúng ảnh nếu URL có trong 'Thông tin tham khảo' bằng cú pháp: ![Mô tả](URL). KHÔNG TỰ BỊA URL ẢNH.",
            f"Phong cách trả lời: {style['tone']}."
        ],
        "en": [
            "You are a friendly and knowledgeable Vietnam travel assistant.",
            "Respond in English.",
            "ONLY embed images if the URL is in the 'Reference context' using syntax: ![Description](URL). DO NOT MAKE UP IMAGE URLS.",
            f"Response style: {style['tone']}."
        ],
        "zh": [
            "你是一个友好且博学的越南旅游助手。",
            "用中文回答（简体中文）。",
            "仅在“参考信息”中包含 URL 时，才使用语法嵌入图像：![描述](URL)。 不要编造图像 URL。",
            f"回复风格：{style['tone']}。"
        ]
    }
    
    prompt_parts = base_prompts.get(language, base_prompts["vi"]).copy()
    
    # 1. Focus instruction (Highest Priority)
    location_focus = ""
    # We can't easily get processing_state here without passing it, but we can infer from user_context
    # Actually, build_system_prompt is called with user_context only.
    
    # 2. Add user preferences if available (Label as background info)
    if user_context.preferred_cities:
        cities = ", ".join(user_context.preferred_cities[:3])
        pref_label = {
            "vi": "Thông tin bổ sung về sở thích người dùng (CHỈ dùng để tham khảo phong cách, KHÔNG tự ý lồng vào địa điểm hiện tại nếu không liên quan)",
            "en": "Additional information about user preferences (Reference ONLY, DO NOT mix into current location unless relevant)",
            "zh": "关于用户偏好的补充信息（仅供参考，除非相关，否则不要混合到当前位置）"
        }.get(language, "Sở thích người dùng")
        prompt_parts.append(f"\n{pref_label}: {cities}.")
    
    if user_context.travel_style:
        style_label = {"vi": "Phong cách du lịch ưu thích", "en": "Preferred travel style", "zh": "喜欢的旅行风格"}.get(language, "Phong cách du lịch")
        prompt_parts.append(f"{style_label}: {user_context.travel_style}.")
    
    if user_context.interests:
        interests = ", ".join(user_context.interests[:3])
        interest_label = {"vi": "Chủ đề quan tâm", "en": "Interests", "zh": "兴趣"}.get(language, "Sở thích")
        prompt_parts.append(f"{interest_label}: {interests}.")

    # Add strict isolation rule
    isolation_rule = {
        "vi": """
QUY TẮC CỐT LÕI: 
1. Tập trung tuyệt đối vào địa điểm người dùng đang hỏi trong tin nhắn mới nhất.
2. KHÔNG tự ý gợi ý các địa điểm ở xa (vd: đang ở miền Bắc KHÔNG gợi ý đi Đà Lạt, Phú Quốc) trừ khi người dùng yêu cầu 'đi đâu tiếp theo' hoặc 'chuyến đi dài ngày'.
3. KIỂM TRA THỰC TẾ: Đảm bảo các địa danh (như 'Thung Lũng Cầu Đất', 'Hồ Xuân Hương') thuộc đúng tỉnh/thành đang thảo luận. Đừng để bị nhầm lẫn bởi địa điểm trong 'Sở thích'.
""",
        "en": """
CORE RULES:
1. Focus strictly on the location mentioned in the latest user message.
2. DO NOT suggest geographically distant locations (e.g., if in North, DON'T suggest Đà Lạt or Phú Quốc) unless the user asks for 'where to go next' or a 'long trip'.
3. FACT CHECK: Ensure landmarks (like 'Cầu Đất', 'Xuân Hương Lake') actually belong to the province/city being discussed. Don't let 'User Preferences' confuse you.
""",
        "zh": """
核心规则：
1. 严格关注最新消息中提到的地点。
2. 除非用户要求“下一步去哪里”或“长途旅行”，否则不要建议地理位置偏远的地点（例如，如果在北部，不要建议去大叻或富国岛）。
3. 事实核查：确保地标（如“Cầu Đất”、“Xuân Hương Lake”）确实属于正在讨论的省/市。 不要让“用户偏好”使您感到困惑。
"""
    }.get(language, "")
    prompt_parts.append(isolation_rule)
    
    # Intent-specific instructions
    intent_instr = {
        "vi": {
            IntentType.CHIT_CHAT: "Đây là chit-chat, hãy trả lời ngắn gọn và thân thiện.",
            IntentType.NEGATIVE_FEEDBACK: "User đang không hài lòng, hãy xin lỗi và cải thiện.",
            "emoji": "Có thể dùng emoji phù hợp."
        },
        "en": {
            IntentType.CHIT_CHAT: "This is chit-chat, respond briefly and friendly.",
            IntentType.NEGATIVE_FEEDBACK: "User is dissatisfied, apologize and improve.",
            "emoji": "You can use appropriate emojis."
        },
        "zh": {
            IntentType.CHIT_CHAT: "这是闲聊，回答要简短友好。",
            IntentType.NEGATIVE_FEEDBACK: "用户不满意，道歉并改进。",
            IntentType.UNRELATED: "这是一个与越南旅游无关的话题。 请有礼貌地拒绝回答，并强调您只能在越南旅游方面提供帮助。",
            "emoji": "可以使用适当的表情符号。"
        }
    }.get(language, {
            IntentType.CHIT_CHAT: "Đây là chit-chat, hãy trả lời ngắn gọn và thân thiện.",
            IntentType.NEGATIVE_FEEDBACK: "User đang không hài lòng, hãy xin lỗi và cải thiện.",
            IntentType.UNRELATED: "Đây là chủ đề KHÔNG liên quan đến du lịch Việt Nam. Hãy từ chối trả lời một cách lịch sự và nhấn mạnh rằng bạn chỉ có thể hỗ trợ về du lịch Việt Nam.",
            "emoji": "Có thể dùng emoji phù hợp."
        })
        
    if intent in intent_instr:
        prompt_parts.append(intent_instr[intent])
    
    if style['emoji']:
        prompt_parts.append(intent_instr.get("emoji", ""))
    
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
        intent=processing_state.intent,
        language=processing_state.language
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
        
    # Inject text files
    text_attachments = [
        att for att in processing_state.attachments
        if att.get("type", "file") in ["file/text", "text/plain", "file"] and type(att.get("url")) is str and len(att.get("url", "")) > 10
    ]
    
    if text_attachments:
        prompt_parts.append("--- NỘI DUNG FILE ĐÍNH KÈM ---")
        for att in text_attachments:
            if not att.get("type", "").startswith("image/"):
                prompt_parts.append(f"Tên file: {att.get('name')}")
                prompt_parts.append(att.get("url")[:15000]) # Cap text
        prompt_parts.append("----------------------------\n")
    
    prompt_parts.append("Hội thoại:")
    prompt_parts.append(conversation)
    prompt_parts.append("")
    instr = {
        "vi": "Trả lời (chi tiết, hữu ích):",
        "en": "Response (detailed, helpful):",
        "zh": "回答（详细、有用）："
    }.get(processing_state.language, "Trả lời (chi tiết, hữu ích):")
    prompt_parts.append(instr)
    
    final_prompt = "\n".join(prompt_parts)
    
    try:
        if processing_state.model_mode == "qwen":
            if get_use_llama():
                response_text = await llama_client.generate(
                    prompt=final_prompt,
                    system_instruction=system_prompt,
                    temperature=config.get('llm.temperature_local', 0.3),
                    max_tokens=config.get('llm.max_tokens_limit', 1024)
                )
                model_name = "qwen3-vl-8b-gguf-llama.cpp"
            else:
                from ..utils.qwen_client import qwen_client
                response_text = await qwen_client.generate(
                    prompt=final_prompt,
                    system_instruction=system_prompt,
                    temperature=config.get('llm.temperature_local', 0.3),
                    max_tokens=config.get('llm.max_tokens_limit', 1024)
                )
                model_name = "qwen3-vl-8b-unsloth"
        else:
            client = gemini_fast
            
            response_text = await client.generate(
                prompt=final_prompt,
                system_instruction=system_prompt,
                temperature=config.get('llm.temperature_default', 0.4),
                max_tokens=config.get('llm.max_tokens_limit', 1024)
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
        err_msg = {
            "vi": "Xin lỗi, tôi gặp lỗi khi xử lý. Bạn có thể thử lại không?",
            "en": "Sorry, I encountered an error. Could you try again?",
            "zh": "抱歉，处理时出错。你能再试一次吗？"
        }.get(processing_state.language, "Xin lỗi, tôi gặp lỗi khi xử lý. Bạn có thể thử lại không?")
        output_state.response = err_msg
        output_state.model_used = "error"
    
    return output_state


async def generate_response_stream(
    processing_state: MessageProcessingState,
    user_context: UserContextState
):
    system_prompt = build_system_prompt(
        user_context=user_context,
        emotion=processing_state.emotion,
        intent=processing_state.intent,
        language=processing_state.language
    )
    
    conversation = build_context_prompt(
        message=processing_state.message,
        history=processing_state.recent_turns or processing_state.history,
        summary=processing_state.conversation_summary
    )
    
    prompt_parts = []
    if processing_state.retrieved_context:
        rag_context = format_context_for_prompt(processing_state.retrieved_context)
        prompt_parts.append(rag_context)
        prompt_parts.append("")
        
    # Inject text files
    text_attachments = [
        att for att in processing_state.attachments
        if att.get("type", "file") in ["file/text", "text/plain", "file"] and isinstance(att.get("url"), str) and len(att.get("url", "")) > 10
    ]
    
    if text_attachments:
        prompt_parts.append("--- NỘI DUNG FILE ĐÍNH KÈM ---")
        for att in text_attachments:
            if not att.get("type", "").startswith("image/"):
                prompt_parts.append(f"Tên file: {att.get('name')}")
                prompt_parts.append(att.get("url")[:15000]) # Cap text length for safety
        prompt_parts.append("----------------------------\n")
    
    prompt_parts.append("Hội thoại:")
    prompt_parts.append(conversation)
    prompt_parts.append("")
    instr = {
    "vi": """
    Hãy trả lời chi tiết và hữu ích cho du khách.

    Yêu cầu:
    - Viết ít nhất 4–6 câu.
    - Nếu là câu hỏi về địa điểm, hãy gợi ý nhiều lựa chọn cụ thể.
    - Có thể thêm mẹo hoặc thông tin hữu ích cho du khách.
    - Trình bày rõ ràng, tự nhiên.
    """,
        "en": """
    Provide a detailed and helpful answer for a traveler.

    Requirements:
    - Write at least 4–6 sentences.
    - If the question is about places, suggest multiple specific options.
    - Add useful tips for travelers when possible.
    - Keep the explanation clear and natural.
    """,
        "zh": """
    请提供详细且有帮助的回答。

    要求：
    - 至少写4–6句话。
    - 如果问题涉及地点，请给出多个具体推荐。
    - 可以补充对游客有用的小提示。
    - 表达清晰自然。
    """
    }.get(
        processing_state.language,
        """
    Hãy trả lời chi tiết và hữu ích cho du khách.
    - Viết ít nhất 4–6 câu.
    - Nếu có thể, đưa ra nhiều gợi ý cụ thể.
    """
    )

    prompt_parts.append(instr)
    
    final_prompt = "\n".join(prompt_parts)
    
    # Extract image URLs from attachments for vision models
    image_urls = [
        att.get("url") for att in processing_state.attachments 
        if att.get("type", "").startswith("image/") and att.get("url")
    ]
    
    if image_urls:
        print(f"📷 Sending {len(image_urls)} image(s) to LLM ({processing_state.model_mode})")
    
    if processing_state.model_mode == "qwen":
        if get_use_llama():
            async for chunk in llama_client.stream_generate(
                prompt=final_prompt,
                system_instruction=system_prompt,
                temperature=config.get('llm.temperature_local', 0.3),
                max_tokens=2048,
                image_urls=image_urls if image_urls else None
            ):
                yield chunk
        else:
            from ..utils.qwen_client import qwen_client
            async for chunk in qwen_client.stream_generate(
                prompt=final_prompt,
                system_instruction=system_prompt,
                temperature=config.get('llm.temperature_local', 0.3),
                max_tokens=2048,
                image_urls=image_urls if image_urls else None
            ):
                yield chunk
    else:
        # We exclusively use gemini_fast (gemini-3-flash-preview) for blazing fast TTFT
        async for chunk in gemini_fast.generate_stream(
            prompt=final_prompt,
            system_instruction=system_prompt,
            temperature=config.get('llm.temperature_default', 0.4),
            max_tokens=2048,
            image_urls=image_urls if image_urls else None
        ):
            yield chunk
