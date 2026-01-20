# Query Rewriter - Transform short/ambiguous queries into standalone questions
# Core fix for context switching bug

import aiohttp
import os
from typing import List, Dict, Optional
from .config import AFFIRMATIVE_WORDS, SHORT_FOLLOWUPS, GEMINI_REWRITE_MODEL, REWRITE_TEMPERATURE, REWRITE_MAX_TOKENS


def is_affirmative(query: str) -> bool:
    """Check if query is a short affirmative response"""
    normalized = query.lower().strip()
    
    # Very short queries are likely affirmatives
    if len(normalized) <= 4:
        return True
    
    # Check against affirmative word list
    for word in AFFIRMATIVE_WORDS:
        if normalized == word or normalized.startswith(word + ' ') or normalized.endswith(' ' + word):
            return True
    
    return False


def is_short_followup(query: str) -> bool:
    """Check if query is a short follow-up needing context"""
    normalized = query.lower().strip()
    
    # Less than 20 chars or contains follow-up phrases
    if len(normalized) < 20:
        for phrase in SHORT_FOLLOWUPS:
            if phrase in normalized:
                return True
    
    return len(normalized.split()) <= 5


def format_history(history: List[Dict]) -> str:
    """Format conversation history for prompt"""
    lines = []
    for msg in history[-4:]:  # Last 4 messages
        role = "User" if msg.get("role") == "user" else "Bot"
        content = msg.get("content", "")[:200]  # Truncate long messages
        lines.append(f"{role}: {content}")
    return "\n".join(lines)


def extract_topic_from_history(history: List[Dict]) -> Optional[str]:
    """Extract the main topic/location from recent conversation"""
    if not history:
        return None
    
    # Look for location names in recent messages (prioritize user messages)
    for msg in reversed(history[-6:]):
        content = msg.get("content", "")
        # Simple heuristic: look for capitalized words that might be locations
        words = content.split()
        for i, word in enumerate(words):
            if word and word[0].isupper() and len(word) > 3:
                # Likely a proper noun (location)
                return word
    
    return None


async def rewrite_query(
    query: str, 
    history: List[Dict], 
    api_key: str
) -> Dict:
    """
    Rewrite a short/ambiguous query into a standalone question.
    
    Returns:
        {
            "original": "có",
            "rewritten": "Cho tôi biết thêm về các hoạt động vui chơi và địa điểm ăn uống gần Biển Nhật Lệ",
            "is_affirmative": True,
            "topic": "Biển Nhật Lệ"
        }
    """
    result = {
        "original": query,
        "rewritten": query,
        "is_affirmative": False,
        "is_followup": False,
        "topic": None
    }
    
    # Check if affirmative
    if is_affirmative(query):
        result["is_affirmative"] = True
    elif is_short_followup(query):
        result["is_followup"] = True
    else:
        # Long enough query - no rewrite needed
        return result
    
    # No history = can't rewrite
    if not history:
        return result
    
    # Extract topic from history
    topic = extract_topic_from_history(history)
    result["topic"] = topic
    
    # Build rewrite prompt
    history_text = format_history(history)
    
    prompt = f"""Bạn là hệ thống rewrite câu hỏi. Dựa vào lịch sử hội thoại, hãy viết lại câu hỏi ngắn thành câu hỏi ĐỘC LẬP, RÕ NGHĨA.

## Lịch sử hội thoại:
{history_text}

## Câu hỏi ngắn của user: "{query}"

## Quy tắc rewrite:
- Nếu user nói "có", "ok", "tiếp" → họ ĐANG MUỐN TIẾP TỤC về chủ đề TRƯỚC ĐÓ
- Giữ nguyên ĐỊA ĐIỂM đang được thảo luận
- Viết lại thành câu hỏi hoàn chỉnh, rõ ràng
- CHỈ trả về câu hỏi đã rewrite, KHÔNG giải thích

## Ví dụ:
- "có" sau khi hỏi về Biển Nhật Lệ → "Cho tôi biết thêm thông tin chi tiết về Biển Nhật Lệ"
- "tiếp" sau khi hỏi lịch trình Hạ Long → "Tiếp tục cho tôi biết lịch trình chi tiết đi Vịnh Hạ Long"

## Câu hỏi đã rewrite:"""

    # Call Gemini API
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_REWRITE_MODEL}:generateContent?key={api_key}"
        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": REWRITE_TEMPERATURE,
                "maxOutputTokens": REWRITE_MAX_TOKENS
            }
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                    if text:
                        result["rewritten"] = text.strip().strip('"').strip("'")
                        print(f"🔄 Query rewritten: '{query}' → '{result['rewritten']}'")
                else:
                    print(f"Rewrite API error: {response.status}")
                    
    except Exception as e:
        print(f"Rewrite error: {e}")
        # Fallback: append topic to query
        if topic:
            result["rewritten"] = f"{query} về {topic}"
    
    return result
