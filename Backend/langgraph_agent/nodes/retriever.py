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
        
        # Verify image links (remove dead ones)
        await verify_image_urls(results)
        
        state.retrieved_context = results
    except Exception as e:
        print(f"Retrieval error: {e}")
        state.retrieved_context = []
    
    return state


# Helper: Check image links
import aiohttp
import asyncio

async def verify_image_urls(context: List[Dict]):
    """Quickly verify image URLs in parallel"""
    if not context: return

    timeout = aiohttp.ClientTimeout(total=1.5)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async def check(item):
            url = item.get("image_url")
            if not url: return
            try:
                async with session.head(url, allow_redirects=True) as resp:
                    if resp.status != 200:
                        print(f"⚠️ Dead Image: {url} ({resp.status})")
                        item["image_url"] = ""
            except Exception:
                # Timeout or connection error
                print(f"⚠️ Dead Image (Error): {url}")
                item["image_url"] = ""

        # Run checks in parallel
        await asyncio.gather(*(check(item) for item in context))


def format_context_for_prompt(context: List[Dict]) -> str:
    """Format retrieved context for LLM prompt"""
    if not context:
        return ""
    
    lines = ["Thông tin tham khảo (bạn có thể dùng các URL ảnh này để hiển thị ảnh cho người dùng bằng Markdown):"]
    for i, item in enumerate(context, 1):
        q = item.get("question", "")
        a = item.get("answer", "")
        img = item.get("image_url", "")
        score = item.get("score", 0)
        
        lines.append(f"\n[{i}] (relevance: {score:.2f})")
        lines.append(f"Q: {q}")
        lines.append(f"A: {a}")
        if img:
            lines.append(f"Image URL: {img}")
    
    return "\n".join(lines)
