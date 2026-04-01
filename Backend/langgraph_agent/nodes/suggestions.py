import json
import re
from typing import List, Dict, Optional
from enum import Enum

from ..state import MessageProcessingState, UserContextState, OutputState
from ..utils.gemini_client import gemini_fast
from utils.config_manager import config


class SuggestionCategory(str, Enum):
    NEXT_STEP = "next_step"       # Follow-up on current topic
    PERSONALIZED = "personalized"  # Based on user preferences
    OPEN_ENDED = "open_ended"      # Exploration prompts


def extract_location_name(text: str) -> str:
    """
    Extract the main location name from response text.
    Looks for patterns like "Địa đạo Vịnh Mốc", "Chùa Một Cột", etc.
    """
    # Common Vietnamese location patterns
    patterns = [
        r'(Địa đạo [A-ZÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴĐ][a-záàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ\s]+)',
        r'(Vườn Quốc gia [A-ZÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴĐ][a-záàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ\s]+)',
        r'(Chùa [A-ZÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴĐ][a-záàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ\s]+)',
        r'(Đền [A-ZÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴĐ][a-záàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ\s]+)',
        r'(Bảo tàng [A-ZÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴĐ][a-záàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ\s]+)',
        r'(Hồ [A-ZÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴĐ][a-záàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ\s]+)',
        r'(Biển [A-ZÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴĐ][a-záàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ\s]+)',
        r'(Núi [A-ZÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴĐ][a-záàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ\s]+)',
        r'(Làng [A-ZÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴĐ][a-záàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ\s]+)',
        r'(Phố cổ [A-ZÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴĐ][a-záàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ\s]+)',
        # Simple place names (2-4 words starting with capital)
        r'([A-ZÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴĐ][a-záàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ]+(?:\s[A-ZÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴĐ][a-záàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ]+){1,3})',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            name = match.group(1).strip()
            # Clean up trailing punctuation
            name = re.sub(r'[,\.\!\?:;]+$', '', name)
            if len(name) > 3:  # Avoid too short matches
                return name
    
    return "địa điểm này"


async def generate_suggestions(
    processing_state: MessageProcessingState,
    user_context: UserContextState,
    output_state: OutputState,
    exclude: List[str] = None
) -> OutputState:
    """
    LangGraph node: Generate LLM-powered suggestions.
    Optimized for Fan-out parallel execution. Uses conversation history instead of RAG context 
    to prevent hallucinations and provide localized, natural follow-ups.
    """
    exclude = exclude or []
    
    # Collect context for personalized suggestions
    # 1. Recently searched/discussed locations
    current_locations = []
    if processing_state.detected_location:
        current_locations.append(processing_state.detected_location)
    
    # Also add locations from retrieved context metadata if available
    for ctx in (processing_state.retrieved_context or []):
        if isinstance(ctx, dict) and ctx.get("name"):
            current_locations.append(ctx["name"])
    
    # Deduplicate and limit
    current_locations = list(dict.fromkeys(current_locations))[:config.get('suggestions.contextual_suggestions_limit', 4)]
    
    # 2. User interests from profile
    user_interests = user_context.interests or []
    
    # Language instruction
    lang_map = {
        "vi": "Hãy gợi ý bằng tiếng Việt.",
        "en": "Respond in English.",
        "zh": "用中文回答。"
    }
    lang_instruction = lang_map.get(processing_state.language, lang_map["vi"])

    # Build conversational context
    context_str = ""
    if processing_state.history:
        for m in processing_state.history[-2:]:
            role = "Bot: " if m['role'] == 'assistant' else "User: "
            context_str += f"{role}{m.get('content', '')[:300]}\n"
            
    context_str += f"User: {processing_state.message[:300]}"
    
    # Prompt LLM to predict follow-ups based on conversation state and requirements
    prompt = f"""Bạn là trợ lý du lịch AI chuyên nghiệp. {lang_instruction}
Dựa trên hội thoại, hãy gợi ý 5 CÂU HỎI mà người dùng có thể muốn hỏi tiếp theo.

YÊU CẦU:
- Đóng vai người dùng để viết câu hỏi (Ví dụ: 'Ở đó có gì ngon?' thay vì 'Gợi ý ẩm thực').
- Nội dung: 60% liên quan đến địa điểm vừa nhắc ({', '.join(current_locations) if current_locations else 'Việt Nam'}), 40% mở rộng.
- Phong cách: Thân thiện, ngắn gọn (dưới 15 từ), KHÔNG dùng emojis, KHÔNG thêm số thứ tự.

Trả về JSON array:
[
  {{ "text": "Câu hỏi tự nhiên 1?", "category": "next_step" }},
  {{ "text": "Câu hỏi tự nhiên 2?", "category": "open_ended" }}
]"""

    try:
        from ..utils.gemini_client import gemini_fast
        from ..utils.llama_client import llama_client
        from ..utils.system_state import get_use_llama
        
        # Prioritize local model if requested or available to save quota
        if get_use_llama() or processing_state.model_mode == "qwen":
             print("🦙 Generating suggestions using local Qwen/Llama...")
             result = await llama_client.generate_json(
                prompt=prompt,
                temperature=0.3,
                max_tokens=1024
            )
        else:
            result = await gemini_fast.generate_json(
                prompt=prompt,
                schema={
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "text": {"type": "string"},
                            "category": {"type": "string"}
                        },
                        "required": ["text"]
                    }
                },
                temperature=config.get('llm.temperature_default', 0.4), # Lower temperature for better adherence to rules
                max_tokens=config.get('llm.max_tokens_limit', 1024)
            )
        
        suggestions_data = result if isinstance(result, list) else []

        if suggestions_data:
            # FIX #5: Normalize categories to the 3 standard values contract requires
            CATEGORY_MAP = {
                "next_step": "next_step",
                "personalized": "personalized",
                "open_ended": "open_ended",
                # LLM sometimes returns these — map them to nearest standard
                "experience": "next_step",
                "food": "next_step",
                "discovery": "open_ended",
                "schedule": "next_step",
                "history": "open_ended",
                "stay": "next_step",
                "weather": "open_ended",
                "tips": "open_ended",
                "trending": "open_ended",
                "itinerary": "next_step",
            }
            formatted_suggestions = []
            for item in suggestions_data:
                if not isinstance(item, dict): continue
                text = item.get("text", "").strip().rstrip('?')
                if not text or len(text) >= 80: continue
                # FIX #6: Skip suggestions whose text is in the exclude list
                if text in exclude or any(text.lower() in ex.lower() for ex in exclude):
                    continue
                raw_cat = item.get("category", "next_step")
                category = CATEGORY_MAP.get(raw_cat, "open_ended")
                formatted_suggestions.append({"text": text, "category": category})

            if len(formatted_suggestions) >= 3:
                output_state.suggested_prompts = formatted_suggestions[:config.get('suggestions.contextual_suggestions_limit', 4)]
                return output_state

    except Exception as e:
        print(f"❌ Suggestions error: {e}")
    
    # FALLBACK: Natural professional suggestions
    # FALLBACK: Natural professional questions
    loc = current_locations[0] if current_locations else "Việt Nam"
    output_state.suggested_prompts = [
        {"text": f"Ở {loc} có những địa điểm check-in nào đẹp vậy bạn?", "category": "next_step"},
        {"text": f"Bạn gợi ý cho mình lịch trình khám phá {loc} 3 ngày nhé?", "category": "next_step"},
        {"text": f"Đi {loc} mùa này thì nên chuẩn bị trang phục thế nào?", "category": "open_ended"},
        {"text": "Có món đặc sản nào nổi tiếng mà mình nên thử không?", "category": "next_step"},
        {"text": "Làm sao để di chuyển đến các điểm tham quan thuận tiện nhất?", "category": "next_step"}
    ]
    
    return output_state


async def refresh_suggestions(
    user_context: UserContextState,
    current_suggestions: List[str],
    last_response: str = ""
) -> List[Dict]:
    """Standalone function for /langgraph/suggestions endpoint."""
    output_state = OutputState()
    output_state.response = last_response or "Bạn muốn khám phá thêm về các địa điểm du lịch Việt Nam không?"
    processing_state = MessageProcessingState(message="")
    
    await generate_suggestions(
        processing_state=processing_state,
        user_context=user_context,
        output_state=output_state,
        exclude=current_suggestions
    )
    
    return output_state.suggested_prompts
