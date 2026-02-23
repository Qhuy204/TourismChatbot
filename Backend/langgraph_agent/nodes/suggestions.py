import json
import re
from typing import List, Dict, Optional
from enum import Enum

from ..state import MessageProcessingState, UserContextState, OutputState
from ..utils.gemini_client import gemini_fast
from ..utils.qwen_client import qwen_client


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
    
    # Build conversational context
    context_str = ""
    if processing_state.history:
        for m in processing_state.history[-2:]:
            role = "Bot: " if m['role'] == 'assistant' else "User: "
            context_str += f"{role}{m.get('content', '')[:300]}\n"
            
    context_str += f"User: {processing_state.message[:300]}"
    
    # Prompt LLM to predict follow-ups based on conversation state
    prompt = f"""Dựa trên đoạn hội thoại ngắn sau, hãy gợi ý 5 câu hỏi tiếp theo NGẮN GỌN (dưới 15 từ) mà người dùng có thể muốn hỏi tiếp.

Đoạn hội thoại:
{context_str}

Yêu cầu:
- Câu hỏi TỰ NHIÊN, như một người dùng thật đang tò mò (Vd: "Ở đó có món gì ngon không?").
- ĐA DẠNG về chủ đề (lịch trình, món ăn, thời tiết, kinh nghiệm).
- Gắn với ngữ cảnh của đoạn chat, KHÔNG hỏi chung chung.
- KHÔNG dùng "Giá vé", "Cách đến" chung chung - hãy sáng tạo hơn!
- KHÔNG bắt đầu bằng "Gợi ý", "Top".

Trả về JSON array THUẦN:
[{{ "text":"Nên đi mùa nào đẹp nhất?", "category":"weather" }}]"""

    try:
        from ..utils.gemini_client import gemini_fast
        
        response = await gemini_fast.generate(
            prompt=prompt,
            temperature=0.7,
            max_tokens=400
        )
        
        # ROBUST JSON extraction
        clean = response.strip()
        if "```" in clean:
            parts = clean.split("```")
            for part in parts:
                if part.strip().startswith("[") or part.strip().startswith("json"):
                    clean = part.replace("json", "").strip()
                    break
        
        start_idx = clean.find("[")
        end_idx = clean.rfind("]")
        
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            json_str = clean[start_idx:end_idx + 1]
            suggestions_data = json.loads(json_str)
            
            formatted_suggestions = []
            for item in suggestions_data:
                text = item.get("text", "").strip()
                category = item.get("category", "next_step")
                if text and len(text) < 60:
                    formatted_suggestions.append({"text": text, "category": category})
            
            if len(formatted_suggestions) >= 3:
                output_state.suggested_prompts = formatted_suggestions[:5]
                return output_state
                
    except Exception as e:
        print(f"❌ Suggestions error: {e}")
    
    # FALLBACK: Extract location name from message or last bot response
    location_name = extract_location_name(processing_state.message)
    if location_name == "địa điểm này" and processing_state.history:
        last_bot = next((m for m in reversed(processing_state.history) if m['role'] == 'assistant'), None)
        if last_bot:
            location_name = extract_location_name(last_bot.get('content', ''))
            
    output_state.suggested_prompts = [
        {"text": f"Du lịch {location_name} nên đi mấy ngày?", "category": "schedule"},
        {"text": f"Đặc sản ở đây là gì?", "category": "food"},
        {"text": "Đi mùa nào đẹp nhất?", "category": "weather"},
        {"text": "Có những khách sạn nào gần đây?", "category": "stay"},
        {"text": "Có những điểm tham quan lân cận nào?", "category": "open_ended"}
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
