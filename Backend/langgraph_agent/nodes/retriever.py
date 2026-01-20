"""
Retriever Node
Fetches relevant context from VQA vector store
"""
from typing import List, Dict

from ..state import MessageProcessingState
from ..retrieval.vqa_store import get_vqa_store


# Configuration
DEFAULT_K = 5
MIN_SCORE = 0.4


async def retrieve_context(state: MessageProcessingState) -> MessageProcessingState:
    """
    LangGraph node: Retrieve relevant VQA context.
    Uses local ChromaDB vector store.
    """
    # Skip if query is not relevant
    if not state.is_relevant:
        state.retrieved_context = []
        return state
    
    # Get query to search
    query = state.rewritten_query or state.message
    
    try:
        # Get VQA store
        store = get_vqa_store()
        
        # Search
        results = store.search(
            query=query,
            k=DEFAULT_K,
            min_score=MIN_SCORE
        )
        
        state.retrieved_context = results
    except Exception as e:
        print(f"Retrieval error: {e}")
        state.retrieved_context = []
    
    return state


def format_context_for_prompt(context: List[Dict]) -> str:
    """Format retrieved context for LLM prompt"""
    if not context:
        return ""
    
    lines = ["Thông tin tham khảo:"]
    for i, item in enumerate(context, 1):
        q = item.get("question", "")
        a = item.get("answer", "")
        score = item.get("score", 0)
        
        lines.append(f"\n[{i}] (relevance: {score:.2f})")
        lines.append(f"Q: {q}")
        lines.append(f"A: {a}")
    
    return "\n".join(lines)
