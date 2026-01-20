"""
LangGraph Tourism Chatbot - FastAPI Entry Point
"""
import os
from contextlib import asynccontextmanager
from typing import List, Dict, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


# ============== Request/Response Models ==============

class ChatRequest(BaseModel):
    user_id: str
    session_id: str
    message: str
    history: List[Dict] = []


class SuggestionItem(BaseModel):
    text: str
    category: str  # next_step | personalized | open_ended


class ChatResponse(BaseModel):
    response: str
    suggested_prompts: List[SuggestionItem]
    emotion_detected: str
    intent: str
    memory_updated: bool = False
    debug: Optional[Dict] = None


class SuggestionsRequest(BaseModel):
    user_id: str
    session_id: str
    exclude: List[str] = []  # Suggestions to exclude (for refresh)


class SuggestionsResponse(BaseModel):
    suggestions: List[SuggestionItem]


class EventRequest(BaseModel):
    user_id: str
    session_id: str
    event_type: str
    event_data: Optional[Dict] = None


# ============== Lifespan ==============

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    print("🚀 Starting LangGraph Tourism Chatbot...")
    
    # Test Gemini connection
    from langgraph_agent.utils.gemini_client import test_connection
    if await test_connection():
        print("✅ Gemini API connected")
    else:
        print("⚠️ Gemini API connection failed - check GEMINI_API_KEY")
    
    # Initialize VQA store in background
    try:
        from langgraph_agent.retrieval.vqa_store import init_vqa_store
        import os
        import asyncio
        from concurrent.futures import ThreadPoolExecutor
        
        # Use absolute path from project root
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        vqa_path = os.path.join(project_root, "Data", "vqa_dataset.jsonl")
        
        # Run indexing in a separate thread to not block the event loop
        loop = asyncio.get_running_loop()
        executor = ThreadPoolExecutor(max_workers=1)
        
        print("⏳ Starting VQA indexing in background...")
        # We don't 'await' this so lifespan can continue
        loop.run_in_executor(executor, init_vqa_store, vqa_path, None)
        
    except Exception as e:
        print(f"⚠️ VQA store background init failed: {e}")
    
    # Initialize graph
    from langgraph_agent.graph import get_graph
    get_graph()
    print("✅ LangGraph initialized")
    
    yield
    
    # Shutdown
    print("👋 Shutting down...")


# ============== FastAPI App ==============

app = FastAPI(
    title="Tourism Chatbot API",
    description="LangGraph-powered chatbot with emotion detection and personalization",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============== Endpoints ==============

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "langgraph-chatbot"}


@app.get("/vqa/status")
async def get_vqa_status():
    """Get current indexing status"""
    from langgraph_agent.retrieval.vqa_store import get_vqa_store
    store = get_vqa_store()
    return store.get_stats()


@app.post("/langgraph/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Main chat endpoint.
    Processes message through LangGraph pipeline.
    """
    from langgraph_agent.graph import run_graph
    
    try:
        result = await run_graph(
            user_id=request.user_id,
            session_id=request.session_id,
            message=request.message,
            history=request.history
        )
        
        # Convert suggestions to response format
        suggestions = [
            SuggestionItem(text=s["text"], category=s["category"])
            for s in result.get("suggested_prompts", [])
        ]
        
        return ChatResponse(
            response=result.get("response", ""),
            suggested_prompts=suggestions,
            emotion_detected=result.get("emotion_detected", "neutral"),
            intent=result.get("intent", "travel_query"),
            memory_updated=result.get("memory_updated", False),
            debug=result.get("debug")
        )
    except Exception as e:
        print(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/langgraph/suggestions", response_model=SuggestionsResponse)
async def get_suggestions(request: SuggestionsRequest):
    """
    Get new suggestions without full chat.
    Supports "đổi gợi ý" feature.
    """
    from langgraph_agent.nodes.suggestions import refresh_suggestions
    from langgraph_agent.state import UserContextState
    
    try:
        # Create minimal user context
        user_context = UserContextState(
            user_id=request.user_id,
            session_id=request.session_id
        )
        
        # Get new suggestions
        suggestions = await refresh_suggestions(
            user_context=user_context,
            current_suggestions=request.exclude
        )
        
        return SuggestionsResponse(
            suggestions=[
                SuggestionItem(text=s["text"], category=s["category"])
                for s in suggestions
            ]
        )
    except Exception as e:
        print(f"Suggestions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/langgraph/event")
async def track_event(request: EventRequest):
    """
    Log user events (clicks, refreshes, etc.) to Supabase.
    """
    from langgraph_agent.memory.store import log_event
    
    try:
        success = await log_event(
            user_id=request.user_id,
            session_id=request.session_id,
            event_type=request.event_type,
            event_data=request.event_data
        )
        return {"status": "ok", "logged": success}
    except Exception as e:
        print(f"Event logging error: {e}")
        return {"status": "error", "message": str(e)}


# ============== Run ==============

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
