try:
    import unsloth
except ImportError:
    pass
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
    model_mode: Optional[str] = "gemini"


class SuggestionItem(BaseModel):
    text: str
    category: str  # next_step | personalized | open_ended


class ChatResponse(BaseModel):
    response: str
    suggested_prompts: List[SuggestionItem]
    emotion_detected: str
    intent: str
    memory_updated: bool = False
    new_title: Optional[str] = None
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


class SessionCreateRequest(BaseModel):
    user_id: str
    session_id: str
    title: str = "Cuộc hội thoại mới"
    first_message: Optional[str] = None


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
        
        # Warm-load Qwen model
        print("⏳ Warm-loading Qwen model in background...")
        from langgraph_agent.utils.qwen_client import qwen_client
        loop.run_in_executor(executor, qwen_client.warm_load)
        
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
    """Main entry point for chatbot interactions"""
    print(f"\n" + "="*50)
    print(f"🚀 NEW CHAT REQUEST | MODE: {request.model_mode} | SESSION: {request.session_id}")
    print(f"="*50)
    
    if not request.user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
        
    from langgraph_agent.graph import run_graph
    
    try:
        result = await run_graph(
            user_id=request.user_id,
            session_id=request.session_id,
            message=request.message,
            history=request.history,
            model_mode=request.model_mode
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
            new_title=result.get("new_title"),
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


@app.get("/langgraph/initial_suggestions/{user_id}")
async def get_initial_suggestions(user_id: str):
    """
    Get personalized initial suggestions for a new chat session.
    """
    from langgraph_agent.memory.store import get_user_preferences
    from langgraph_agent.utils.gemini_client import gemini_fast
    import json
    
    prefs = await get_user_preferences(user_id)
    
    # Default suggestions in case nothing else works
    default_data = {
        "welcome_message": "Tôi là trợ lý du lịch AI. Hãy hỏi tôi về các địa điểm du lịch Việt Nam, gợi ý lịch trình, hoặc thông tin về các điểm tham quan!",
        "suggestions": [
            {"text": "Gợi ý địa điểm du lịch biển", "category": "personalized"},
            {"text": "Đà Nẵng có gì hay?", "category": "personalized"},
            {"text": "Địa điểm du lịch miền Trung", "category": "personalized"}
        ]
    }
    
    if not prefs or (not prefs.get("interests") and not prefs.get("preferred_cities")):
        return default_data
        
    # Generate personalized suggestions using Gemini
    try:
        pref_str = ""
        if prefs.get("interests"): pref_str += f"- Sở thích: {', '.join(prefs['interests'])}\n"
        if prefs.get("preferred_cities"): pref_str += f"- Thành phố quan tâm: {', '.join(prefs['preferred_cities'])}\n"
        
        prompt = f"""
        Dựa trên sở thích du lịch của người dùng này:
        {pref_str}
        
        Hãy tạo:
        1. Một câu chào mừng cực kỳ ngắn gọn (dưới 15 từ) mời họ hỏi về du lịch dựa trên sở thích của họ.
        2. 3 gợi ý câu hỏi mẫu (dưới 10 từ mỗi câu) mà họ có thể muốn hỏi ngay bây giờ.
        
        Trả về định dạng JSON:
        {{
            "welcome_message": "...",
            "suggestions": [
                {{"text": "...", "category": "personalized"}},
                ...
            ]
        }}
        Chỉ trả về JSON thô, không có dấu ngoặc ``` hay văn bản thừa nào khác.
        """
        
        response = await gemini_fast.generate_content(prompt)
        # Attempt to parse
        clean_res = response.strip().strip('```json').strip('```').strip()
        return json.loads(clean_res)
    except Exception as e:
        print(f"⚠️ Error generating personalized suggestions: {e}")
        return default_data


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


# ============== Session Management Endpoints ==============

@app.get("/langgraph/sessions/{user_id}")
async def list_sessions(user_id: str):
    """List all chat sessions for a user"""
    from langgraph_agent.memory.store import get_chat_sessions
    sessions = await get_chat_sessions(user_id)
    return {"sessions": sessions}


@app.post("/langgraph/sessions")
async def create_or_update_session(request: SessionCreateRequest):
    """Create or update a session title/metadata"""
    from langgraph_agent.memory.store import upsert_chat_session
    success = await upsert_chat_session(
        user_id=request.user_id,
        session_id=request.session_id,
        title=request.title,
        first_message=request.first_message
    )
    return {"status": "ok" if success else "error"}


@app.delete("/langgraph/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and its logs"""
    from langgraph_agent.memory.store import delete_chat_session
    success = await delete_chat_session(session_id)
    return {"status": "ok" if success else "error"}


@app.get("/langgraph/history/{session_id}")
async def get_history(session_id: str):
    """Get full message history for a session"""
    from langgraph_agent.memory.store import get_session_history
    history = await get_session_history(session_id)
    return {"history": history}


# ============== Run ==============

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_excludes=["unsloth_compiled_cache", "**/__pycache__/*"]
    )
