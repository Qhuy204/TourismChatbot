# RAG Pipeline - Main orchestrator
# Handles: Query Rewrite → Retrieval → Response Generation

from typing import List, Dict, Optional, Any
from .query_rewriter import rewrite_query, is_affirmative


async def process_rag_query(
    query: str,
    history: List[Dict],
    api_key: str,
    retriever_fn: Optional[Any] = None  # Function to call for retrieval
) -> Dict:
    """
    Main RAG pipeline entry point.
    
    Flow:
    1. Check if query needs rewriting (affirmative/short follow-up)
    2. Rewrite query if needed
    3. Call retriever with rewritten query
    4. Return context for LLM
    
    Args:
        query: User's current message
        history: List of previous messages [{role, content}, ...]
        api_key: Gemini API key
        retriever_fn: Optional async function for retrieval
        
    Returns:
        {
            "original_query": "có",
            "rewritten_query": "Cho tôi biết thêm về Biển Nhật Lệ",
            "skip_retrieval": False,
            "topic": "Biển Nhật Lệ",
            "context": [...],  # Retrieved documents if any
            "debug": {...}
        }
    """
    result = {
        "original_query": query,
        "rewritten_query": query,
        "skip_retrieval": False,
        "topic": None,
        "context": [],
        "debug": {
            "is_affirmative": False,
            "is_followup": False,
            "rewrite_applied": False
        }
    }
    
    # Step 1: Rewrite query if needed
    rewrite_result = await rewrite_query(query, history, api_key)
    
    result["rewritten_query"] = rewrite_result["rewritten"]
    result["topic"] = rewrite_result.get("topic")
    result["debug"]["is_affirmative"] = rewrite_result.get("is_affirmative", False)
    result["debug"]["is_followup"] = rewrite_result.get("is_followup", False)
    result["debug"]["rewrite_applied"] = rewrite_result["rewritten"] != query
    
    # Step 2: Decide if we should skip retrieval
    # For pure affirmatives like "có", "ok" - we may want to skip and use history context
    if rewrite_result.get("is_affirmative") and not rewrite_result.get("topic"):
        # No topic extracted - skip retrieval, rely on history
        result["skip_retrieval"] = True
        print(f"⏭️ Skipping retrieval - affirmative with no topic")
    
    # Step 3: Call retriever if available and not skipped
    if retriever_fn and not result["skip_retrieval"]:
        try:
            search_query = result["rewritten_query"]
            context = await retriever_fn(search_query)
            result["context"] = context
            print(f"📚 Retrieved {len(context)} documents for: {search_query}")
        except Exception as e:
            print(f"Retrieval error: {e}")
    
    return result


def build_enhanced_prompt(
    query: str,
    rewritten_query: str,
    history: List[Dict],
    context: List[Dict],
    topic: Optional[str] = None
) -> str:
    """
    Build an enhanced prompt that emphasizes context continuity.
    """
    # Format history
    history_text = ""
    for msg in history[-6:]:
        role = "Người dùng" if msg.get("role") == "user" else "Trợ lý"
        content = msg.get("content", "")[:300]
        history_text += f"{role}: {content}\n"
    
    # Format context
    context_text = ""
    if context:
        context_text = "\n--- DỮ LIỆU TỪ DATABASE ---\n"
        for doc in context[:5]:
            context_text += f"\n📍 {doc.get('name', 'Unknown')}\n"
            if doc.get('description'):
                context_text += f"   {doc['description'][:200]}\n"
    
    # Build main prompt
    prompt = f"""Bạn là trợ lý du lịch Việt Nam thân thiện và chuyên nghiệp.

## 🔴 QUY TẮC QUAN TRỌNG NHẤT:
- Nếu user nói "có", "ok", "tiếp" → **TIẾP TỤC chủ đề trước đó**
- **KHÔNG** bắt đầu topic mới khi user chỉ xác nhận
- Chủ đề đang thảo luận: **{topic or 'Xem lịch sử chat'}**

## Lịch sử hội thoại:
{history_text}

{context_text}

## Câu hỏi gốc: "{query}"
## Câu hỏi đã hiểu: "{rewritten_query}"

Hãy trả lời câu hỏi đã hiểu, TIẾP TỤC chủ đề trước đó."""

    return prompt
