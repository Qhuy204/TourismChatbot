try:
    import unsloth
except ImportError:
    pass
import os
import json
from contextlib import asynccontextmanager
from typing import List, Dict, Optional
import asyncio

from fastapi import FastAPI, HTTPException, Depends, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ============== Globals ==============
from langgraph_agent.utils.system_state import get_app_state, set_app_state
# APP_STATE is now managed via system_state.py (get_app_state/set_app_state)

# ============== Request/Response Models ==============

class ChatRequest(BaseModel):
    user_id: str
    session_id: str
    message: str
    history: List[Dict] = []
    model_mode: Optional[str] = "gemini"
    attachments: Optional[List[Dict]] = None  # [{url, type, name}]
    language: Optional[str] = "vi"


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
    extracted_locations: Optional[List[Dict]] = None


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


class LocationInsertRequest(BaseModel):
    name: str
    city: Optional[str] = None
    province: Optional[str] = None
    category: str = "other"
    description: Optional[str] = None
    details: Optional[Dict] = None
    source_id: Optional[int] = None


class DuplicateCleanupRequest(BaseModel):
    threshold: float = 0.85
    dry_run: bool = True


class RecommendationsRequest(BaseModel):
    user_id: str
    topics: Optional[List[str]] = None
    recent_locations: Optional[List[str]] = None
    limit: int = 5
    language: Optional[str] = "vi"


class ContextualSuggestionsRequest(BaseModel):
    """Request for AI-generated contextual suggestions based on recent locations"""
    locations: List[str]  # Recent locations from response
    last_question: Optional[str] = None  # User's last question for context
    user_messages: Optional[List[str]] = []  # Recent user messages for style mimicry
    limit: int = 4

# ============== Admin API Models (Merged) ==============

from langgraph_agent.utils.security import Admin

class QuotaOverrideRequest(BaseModel):
    daily_requests: Optional[int] = None
    daily_tokens: Optional[int] = None

class BanRequest(BaseModel):
    ban: bool
    reason: Optional[str] = "Admin Decision"

class RoleChangeRequest(BaseModel):
    role: str

class DuplicateCleanupRequest(BaseModel):
    threshold: float = 0.85
    dry_run: bool = True


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

# ============== Security & Tracing Middleware ==============
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse as StarletteJSONResponse
import signal
import uuid

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

app.add_middleware(RequestIDMiddleware)

class SecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        from langgraph_agent.utils.security import check_ip_rate_limit, SECURITY_HEADERS
        # 1. Check System State (Maintenance/Draining)
        # We reject new chat requests if the system is not RUNNING
        if request.url.path.startswith("/langgraph/chat"):
            state = get_app_state()
            if state in ("MAINTENANCE", "DRAINING"):
                return StarletteJSONResponse(
                    {"detail": f"System is currently in {state.lower()} mode. Please try again shortly."},
                    status_code=503,
                    headers={"Retry-After": "30"}
                )

        # 2. IP rate limiting on chat endpoints
        client_ip = request.client.host if request.client else "unknown"
        if request.url.path.startswith("/langgraph/chat"):
            allowed, remaining = check_ip_rate_limit(client_ip)
            if not allowed:
                return StarletteJSONResponse(
                    {"detail": "Too many requests. Please slow down."},
                    status_code=429,
                    headers={"Retry-After": "60"}
                )

        response = await call_next(request)

        # 3. Add security headers
        for key, value in SECURITY_HEADERS.items():
            response.headers[key] = value
        return response

app.add_middleware(SecurityMiddleware)

# ============== Graceful Shutdown ==============

# Graceful shutdown is handled by the lifespan context manager below.

async def wait_for_idle(timeout: int = 30):
    """Wait for all active GPU requests to finish before shutdown"""
    from langgraph_agent.utils.gpu_queue import get_gpu_queue
    queue = get_gpu_queue()
    start_time = time.time()
    
    while queue.active_requests > 0:
        if time.time() - start_time > timeout:
            print(f"⚠️ Shutdown timeout reached ({timeout}s). {queue.active_requests} requests still active. Forcing exit.")
            break
        print(f"⏳ Waiting for {queue.active_requests} active GPU requests to finish...")
        await asyncio.sleep(1)
    print("✅ All active GPU requests finished.")

# Update lifespan to include the wait
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 Starting LangGraph Tourism Chatbot...")
    set_app_state("RUNNING")
    
    # ... (INITIALIZATION LOGIC REMAINS)
    from langgraph_agent.utils.gemini_client import test_connection
    if await test_connection(): print("✅ Gemini API connected")
    
    try:
        from langgraph_agent.retrieval.vqa_store import init_vqa_store
        loop = asyncio.get_running_loop()
        executor = ThreadPoolExecutor(max_workers=1)
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        vqa_path = os.path.join(project_root, "Data", "vqa_dataset.jsonl")
        loop.run_in_executor(executor, init_vqa_store, vqa_path, None)
        from langgraph_agent.utils.qwen_client import qwen_client
        loop.run_in_executor(executor, qwen_client.warm_load)
    except Exception as e: print(f"⚠️ Init failed: {e}")
    
    yield
    
    # Shutdown
    print("👋 Shutdown initiated. Finalizing active requests...")
    set_app_state("DRAINING")
    await wait_for_idle(timeout=30)
    print("👋 Goodbye!")


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
            model_mode=request.model_mode,
            language=request.language
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
            debug=result.get("debug"),
            extracted_locations=result.get("extracted_locations", [])
        )
    except Exception as e:
        print(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/langgraph/chat/stream")
async def chat_stream(request: ChatRequest):
    """Streaming entry point for chatbot interactions"""
    if not request.user_id:
        raise HTTPException(status_code=400, detail="user_id is required")

    # Rate limiting check
    from langgraph_agent.utils.rate_limiter import check_quota, increment_usage
    allowed, reason, usage_info = check_quota(request.user_id)
    if not allowed:
        async def quota_exceeded():
            yield f"data: {json.dumps({'type': 'error', 'message': reason, 'quota_exceeded': True, 'usage': usage_info}, ensure_ascii=False)}\n\n"
        return StreamingResponse(quota_exceeded(), media_type="text/event-stream", status_code=200)

    from langgraph_agent.graph import run_graph_stream

    async def event_generator():
        try:
            async for chunk in run_graph_stream(
                user_id=request.user_id,
                session_id=request.session_id,
                message=request.message,
                history=request.history,
                model_mode=request.model_mode,
                attachments=request.attachments,
                language=request.language
            ):
                yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
            # Increment usage after successful stream
            increment_usage(request.user_id, requests=1)
        except Exception as e:
            print(f"Streaming error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/langgraph/usage/{user_id}")
async def get_usage(user_id: str):
    """Get user's current usage and quota limits"""
    from langgraph_agent.utils.rate_limiter import check_quota
    _, _, usage_info = check_quota(user_id)
    return usage_info


@app.post("/langgraph/suggestions", response_model=SuggestionsResponse)
async def get_suggestions(request: SuggestionsRequest):
    from langgraph_agent.nodes.suggestions import refresh_suggestions
    from langgraph_agent.state import UserContextState
    
    try:
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


@app.post("/langgraph/initial_suggestions")
async def get_initial_suggestions(request: RecommendationsRequest):
    from langgraph_agent.memory.store import get_user_preferences
    from langgraph_agent.utils.gemini_client import gemini_fast
    
    user_id = request.user_id
    topics = request.topics or []
    recent_locations = request.recent_locations or []
    
    prefs = await get_user_preferences(user_id) if user_id else {}
    
    # Merge preferences from DB and topics from cookies
    all_interests = list(set((prefs.get("interests") or []) + topics))
    preferred_cities = prefs.get("preferred_cities") or []
    
    # Default suggestions based on language
    defaults = {
        "vi": {
            "welcome_message": "Xin chào! Tôi có thể giúp gì cho chuyến du lịch của bạn?",
            "suggestions": [
                {"text": "Địa điểm du lịch hot nhất 2026", "category": "trending"},
                {"text": "Gợi ý du lịch biển đẹp", "category": "discovery"},
                {"text": "Lịch trình Đà Nẵng 3 ngày", "category": "itinerary"},
                {"text": "Ẩm thực đường phố Hà Nội", "category": "food"},
                {"text": "Cẩm nang du lịch trải nghiệm", "category": "tips"}
            ]
        },
        "en": {
            "welcome_message": "Hello! How can I help with your travel plans?",
            "suggestions": [
                {"text": "Top trending destinations 2026", "category": "trending"},
                {"text": "Beautiful beach recommendations", "category": "discovery"},
                {"text": "3-day Da Nang itinerary", "category": "itinerary"},
                {"text": "Hanoi street food guide", "category": "food"},
                {"text": "Adventure travel handbook", "category": "tips"}
            ]
        },
        "zh": {
            "welcome_message": "您好！我能为您的旅游计划提供什么帮助？",
            "suggestions": [
                {"text": "2026年热门旅游目的地", "category": "trending"},
                {"text": "美丽海滩推荐", "category": "discovery"},
                {"text": "岘港3日游行程", "category": "itinerary"},
                {"text": "河内街头美食指南", "category": "food"},
                {"text": "探险旅游手册", "category": "tips"}
            ]
        }
    }
    
    default_data = defaults.get(request.language, defaults["vi"])
    
    if not all_interests and not preferred_cities:
        return default_data
    
    try:
        # Build context string from interests
        interest_str = ", ".join(all_interests[:5])
        city_str = ", ".join(preferred_cities[:3]) if preferred_cities else ""
        recent_loc_str = ", ".join(recent_locations[:3]) if recent_locations else ""
        
        lang_instruction = {
            "vi": "Hãy trả lời bằng tiếng Việt.",
            "en": "Respond in English.",
            "zh": "用中文回答（简体中文）。"
        }.get(request.language, "Hãy trả lời bằng tiếng Việt.")
        
        prompt = f"""Bạn là trợ lý du lịch AI thông minh. {lang_instruction}
Người dùng đặc biệt quan tâm các chủ đề: {interest_str}
{f"Các địa điểm tìm kiếm gần nhất: {recent_loc_str}" if recent_loc_str else f"Địa điểm yêu thích: {city_str}" if city_str else ""}

Hãy tạo nội dung gợi ý NGẮN GỌN, HỮU ÍCH:

1. Lời chào (dưới 15 từ):
   - Thân thiện, lịch sự, không quá suồng sã.
   - VD: "Chào bạn, hôm nay bạn muốn khám phá ở đâu?", "Mình có thể giúp bạn lên kế hoạch đi đâu?"

2. 5 gợi ý TÌM KIẾM (như keyword):
   - Khoảng 60% (3 gợi ý) liên quan trực tiếp đến "Các địa điểm tìm kiếm gần nhất" (nếu có).
   - Khoảng 40% (2 gợi ý) liên quan đến "chủ đề" người dùng quan tâm ở các địa điểm nổi tiếng khác.
   - Tập trung vào thông tin thực tế.
   - KHÔNG dùng emojis.
   - KHÔNG dùng "nhé", "nha", "thử xem".
   - KHÔNG dùng dấu "?".
   - VD: "Kinh nghiệm du lịch Phú Quốc", "Lịch trình Đà Lạt 3 ngày", "Đặc sản phở Hà Nội", "Vé cáp treo Bà Đen"

Trả về JSON nguyên vẹn, đảm bảo điền nội dung cụ thể không viết tắt:
{{
    "welcome_message": "<Câu chào ngắn gọn>",
    "suggestions": [
        {{"text": "<Giá trị gợi ý 1>", "category": "itinerary"}},
        {{"text": "<Giá trị gợi ý 2>", "category": "experience"}},
        {{"text": "<Giá trị gợi ý 3>", "category": "tips"}},
        {{"text": "<Giá trị gợi ý 4>", "category": "discovery"}},
        {{"text": "<Giá trị gợi ý 5>", "category": "food"}}
    ]
}}"""
        
        response = await gemini_fast.generate_json(prompt, schema={
            "type": "object",
            "properties": {
                "welcome_message": {"type": "string"},
                "suggestions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "text": {"type": "string"},
                            "category": {"type": "string"}
                        }
                    }
                }
            }
        })
        
        return response
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


class ContextualSuggestionsRequest(BaseModel):
    locations: List[str]
    last_question: Optional[str] = None
    last_response: Optional[str] = None
    user_messages: Optional[List[Dict]] = []
    limit: int = 4
    language: Optional[str] = "vi"

@app.post("/langgraph/contextual_suggestions")
async def get_contextual_suggestions(request: ContextualSuggestionsRequest):
    from langgraph_agent.utils.gemini_client import gemini_fast
    
    locations = request.locations[:3]  # Max 3 locations
    last_question = request.last_question or ""
    last_response = request.last_response or ""
    limit = min(request.limit, 5)
    
    if not locations and not request.user_messages and not last_response:
        return {"suggestions": []}
    
    try:
        lang_instruction = {
            "vi": "Hãy trả lời bằng tiếng Việt.",
            "en": "Respond in English.",
            "zh": "用中文回答（简体中文）。"
        }.get(request.language, "Hãy trả lời bằng tiếng Việt.")

        if locations:
            locations_str = f"Người dùng đang tìm hiểu về các địa điểm: {', '.join(locations)}\n"
        else:
            locations_str = "Dựa trên nội dung cuộc trò chuyện hiện tại:\n"
            
        context_hint = f"\nCâu hỏi trước: {last_question}" if last_question else ""
        if last_response:
            context_hint += f"\nPhản hồi tự động: {last_response}"
        
        # Analyze user style if messages provided
        style_instruction = ""
        if request.user_messages:
            # Handle list of dicts or list of strings
            msg_list = []
            for m in request.user_messages[-5:]:
                if isinstance(m, dict): msg_list.append(m.get("content", ""))
                else: msg_list.append(str(m))
            samples = "\n".join([f'- "{msg}"' for msg in msg_list])
            style_instruction = f"""
PHONG CÁCH CỦA USER (Hãy bắt chước tone giọng này):
{samples}
"""

        prompt = f"""{locations_str}{context_hint}
{style_instruction}
{lang_instruction}

Tạo {limit} câu hỏi gợi ý tiếp theo TỰ NHIÊN, NGẮN GỌN (dưới 15 từ) để kích thích cuộc hội thoại.

QUY TẮC:
- Đa dạng chủ đề: ăn uống, lịch trình, thời tiết, kinh nghiệm, khách sạn.
- Câu hỏi thực tế, như một người dùng thật đang tò mò (Vd: "Đi Hội An mùa nào thì bớt đông?").
- KHÔNG dùng "Gợi ý", "Top", "Du lịch X mấy ngày?" máy móc.

Trả về JSON mẫu:
{{
    "suggestions": [
        {{ "text": "Hội An có món gì ngon ngoài Cao Lầu không?", "category": "food" }},
        {{ "text": "Buổi tối ở Phố Cổ có hoạt động gì thú vị?", "category": "experience" }},
        {{ "text": "Nên ở khách sạn nào gần trung tâm?", "category": "stay" }},
        {{ "text": "Có tour đi Cù Lao Chàm trong ngày không?", "category": "discovery" }}
    ]
}}"""
        
        result = await gemini_fast.generate_json(prompt, schema={
            "type": "object",
            "properties": {
                "suggestions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "text": {"type": "string"},
                            "category": {"type": "string"}
                        },
                        "required": ["text"]
                    }
                }
            },
            "required": ["suggestions"]
        })
        
        suggestions = result.get("suggestions", [])
        if not isinstance(suggestions, list):
            suggestions = []
            
        return {"suggestions": suggestions[:limit]}
    except Exception as e:
        print(f"⚠️ Error generating contextual suggestions: {e}")
        # Fallback to simple suggestions
        loc = locations[0]
        return {
            "suggestions": [
                {"text": f"Du lịch {loc} mấy ngày?", "category": "schedule"},
                {"text": f"Đặc sản {loc} là gì?", "category": "food"},
                {"text": f"Đi {loc} mùa nào đẹp?", "category": "weather"}
            ][:limit]
        }


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


@app.delete("/langgraph/sessions/cleanup/{session_id}")
async def cleanup_empty_session(session_id: str):
    """Delete a session ONLY if it has no messages"""
    from langgraph_agent.memory.store import cleanup_empty_chat_session
    success = await cleanup_empty_chat_session(session_id)
    return {"status": "ok", "cleaned_up": success}


@app.get("/langgraph/history/{session_id}")
async def get_history(session_id: str):
    """Get full message history for a session"""
    from langgraph_agent.memory.store import get_session_history
    history = await get_session_history(session_id)
    return {"history": history}


@app.get("/langgraph/sessions/{session_id}/export")
async def export_session(session_id: str):
    """Export full session with metadata + messages as JSON"""
    from langgraph_agent.memory.store import get_session_history, get_supabase
    from fastapi.responses import JSONResponse
    from datetime import datetime, timezone

    sb = get_supabase()

    # Get session metadata
    session_resp = sb.table("chat_sessions").select("*").eq("id", session_id).execute()
    session_data = session_resp.data[0] if session_resp.data else {}

    # Get all messages
    history = await get_session_history(session_id)

    export = {
        "session": {
            "id": session_data.get("id", session_id),
            "title": session_data.get("title", "Untitled"),
            "created_at": session_data.get("created_at"),
            "updated_at": session_data.get("updated_at"),
            "message_count": len(history),
        },
        "messages": history,
        "exported_at": datetime.now(timezone.utc).isoformat(),
    }

    return JSONResponse(
        content=export,
        headers={
            "Content-Disposition": f'attachment; filename="session_{session_id[:8]}.json"'
        }
    )


# ============== Location Deduplication Endpoints ==============

@app.post("/langgraph/locations/insert")
async def insert_location(request: LocationInsertRequest):
    from langgraph_agent.memory.store import insert_location_smart
    
    result = await insert_location_smart(
        name=request.name,
        city=request.city,
        province=request.province,
        category=request.category,
        description=request.description,
        details=request.details,
        source_id=request.source_id
    )
    return result


@app.get("/langgraph/locations/check-duplicate/{name}")
async def check_location_dup(name: str, threshold: float = 0.85):
    from langgraph_agent.memory.store import check_location_duplicate
    
    duplicates = await check_location_duplicate(name, threshold)
    return {"duplicates": duplicates, "has_duplicate": len(duplicates) > 0}


@app.get("/langgraph/locations/find-duplicates")
async def find_location_duplicates(min_similarity: float = 0.6):
    """Scan all locations for duplicate pairs"""
    from langgraph_agent.memory.store import find_duplicate_locations
    
    pairs = await find_duplicate_locations(min_similarity)
    return {"duplicate_pairs": pairs, "count": len(pairs)}


@app.post("/langgraph/locations/cleanup")
async def cleanup_locations(request: DuplicateCleanupRequest):
    from langgraph_agent.memory.store import cleanup_duplicate_locations
    
    results = await cleanup_duplicate_locations(
        threshold=request.threshold,
        dry_run=request.dry_run
    )
    return {
        "actions": results,
        "total_affected": len(results),
        "dry_run": request.dry_run
    }


# ============== Admin API Endpoints (Merged) ==============

import time
from fastapi import BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, Response, StreamingResponse
from langgraph_agent.utils.security import require_admin, check_admin_rate_limit, log_admin_action, Admin
from langgraph_agent.utils.metrics import get_system_metrics

# In-memory storage for async export results (replaces Redis temp keys)
# Key: export_id, Value: {"status": str, "data": str, "expiry": float}
_EXPORT_RESULTS: Dict[str, Dict] = {}

def _cleanup_exports():
    """Helper to remove expired exports from memory"""
    now = time.time()
    expired = [k for k, v in _EXPORT_RESULTS.items() if v.get("expiry", 0) < now]
    for k in expired: del _EXPORT_RESULTS[k]

@app.get("/admin/health/deep")
async def deep_health_check(request: Request, admin: Admin = Depends(require_admin)):
    """Comprehensive system diagnostics for administrators"""
    check_admin_rate_limit(admin.id, tier="standard")
    
    health = {
        "status": "healthy",
        "timestamp": time.time(),
        "request_id": request.state.request_id,
        "components": {}
    }
    
    # 1. Database (Supabase)
    try:
        from langgraph_agent.memory.store import get_supabase
        sb = get_supabase()
        start = time.time()
        sb.table("user_roles").select("count", count="exact").limit(1).execute()
        latency = (time.time() - start) * 1000
        health["components"]["database"] = {"status": "up", "latency_ms": round(latency, 2)}
    except Exception as e:
        health["components"]["database"] = {"status": "down", "error": str(e)}
        health["status"] = "degraded"

    # 2. GPU
    from langgraph_agent.utils.metrics import get_system_metrics
    metrics = get_system_metrics()
    gpu = metrics.get("gpu", {})
    health["components"]["gpu"] = {"status": "up" if "error" not in gpu else "error", "details": gpu}

    # 3. Qwen (Local Model)
    try:
        from langgraph_agent.utils.qwen_client import qwen_client
        health["components"]["qwen"] = {
            "status": "up" if qwen_client._is_initialized else "warmup_required",
            "is_initialized": qwen_client._is_initialized
        }
    except Exception as e:
        health["components"]["qwen"] = {"status": "error", "error": str(e)}

    # 4. Gemini (External API)
    try:
        from langgraph_agent.utils.gemini_client import test_connection
        is_up = await test_connection()
        health["components"]["gemini"] = {"status": "up" if is_up else "down"}
    except Exception as e:
        health["components"]["gemini"] = {"status": "error", "error": str(e)}

    return health

@app.get("/admin/limits")
async def get_all_limits(request: Request, admin: Admin = Depends(require_admin)):
    check_admin_rate_limit(admin.id, tier="standard")
    from langgraph_agent.memory.store import get_supabase
    sb = get_supabase()
    limits_resp = sb.table("quota_limits").select("*").execute()
    overrides_resp = sb.table("user_quota_overrides").select("*").execute()
    return {"roles": limits_resp.data or [], "overrides": overrides_resp.data or []}

@app.put("/admin/limits/user/{target_user_id}")
async def set_user_override(target_user_id: str, payload: QuotaOverrideRequest, request: Request, admin: Admin = Depends(require_admin)):
    check_admin_rate_limit(admin.id, tier="standard")
    from langgraph_agent.memory.store import get_supabase
    sb = get_supabase()
    try:
        if payload.daily_requests is None and payload.daily_tokens is None:
            sb.table("user_quota_overrides").delete().eq("user_id", target_user_id).execute()
            action = "remove_quota_override"
        else:
            data = {"user_id": target_user_id, "updated_by": admin.id}
            if payload.daily_requests is not None: data["daily_requests"] = payload.daily_requests
            if payload.daily_tokens is not None: data["daily_tokens"] = payload.daily_tokens
            sb.table("user_quota_overrides").upsert(data, on_conflict="user_id").execute()
            action = "set_quota_override"
        log_admin_action(admin_user_id=admin.id, action=action, target_type="user", target_id=target_user_id, metadata=payload.model_dump(), ip_address=request.client.host if request.client else None, request_id=request.state.request_id)
        return {"success": True}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/admin/users")
async def admin_list_users(request: Request, admin: Admin = Depends(require_admin)):
    check_admin_rate_limit(admin.id, tier="standard")
    from langgraph_agent.memory.store import get_supabase
    sb = get_supabase()
    roles_resp = sb.table("user_roles").select("user_id, role").execute()
    roles_map = {r["user_id"]: r["role"] for r in (roles_resp.data or [])}
    msg_resp = sb.table("chat_logs").select("user_id", count="exact").execute()
    sessions_resp = sb.table("chat_sessions").select("user_id, created_at").order("created_at", desc=True).execute()
    user_messages = {}; user_sessions = {}; user_last_active = {}
    for log in (msg_resp.data or []):
        uid = log.get("user_id")
        if uid: user_messages[uid] = user_messages.get(uid, 0) + 1
    for sess in (sessions_resp.data or []):
        uid = sess.get("user_id")
        if uid:
            user_sessions[uid] = user_sessions.get(uid, 0) + 1
            if uid not in user_last_active: user_last_active[uid] = sess.get("created_at")
    try:
        users_resp = sb.auth.admin.list_users()
        auth_users = users_resp if isinstance(users_resp, list) else (users_resp.users if hasattr(users_resp, 'users') else [])
    except Exception: auth_users = []
    result = []
    for au in auth_users:
        uid = getattr(au, 'id', au.get('id', '')) if not isinstance(au, dict) else au.get('id', '')
        email = getattr(au, 'email', au.get('email', '')) if not isinstance(au, dict) else au.get('email', '')
        meta = getattr(au, 'user_metadata', au.get('user_metadata', {})) if not isinstance(au, dict) else au.get('user_metadata', {})
        created = getattr(au, 'created_at', au.get('created_at', '')) if not isinstance(au, dict) else au.get('created_at', '')
        banned = getattr(au, 'banned_until', au.get('banned_until', '')) if not isinstance(au, dict) else au.get('banned_until', '')
        result.append({"id": uid, "email": email, "display_name": (meta or {}).get("display_name", ""), "role": roles_map.get(uid, "user"), "created_at": str(created), "is_banned": bool(banned), "message_count": user_messages.get(uid, 0), "session_count": user_sessions.get(uid, 0), "last_active": user_last_active.get(uid)})
    return result

@app.get("/admin/metrics")
async def admin_metrics(request: Request, admin: Admin = Depends(require_admin)):
    check_admin_rate_limit(admin.id, tier="heavy")
    from langgraph_agent.memory.store import get_supabase
    from datetime import date
    sb = get_supabase(); today = date.today().isoformat()
    users_resp = sb.table("user_roles").select("*", count="exact").execute()
    msgs_resp = sb.table("chat_logs").select("*", count="exact").execute()
    sessions_resp = sb.table("chat_sessions").select("*", count="exact").execute()
    today_msgs = sb.table("chat_logs").select("*", count="exact").gte("created_at", f"{today}T00:00:00").execute()
    today_active = sb.table("usage_tracking").select("user_id", count="exact").eq("date", today).execute()
    return {"total_users": users_resp.count or 0, "total_messages": msgs_resp.count or 0, "total_sessions": sessions_resp.count or 0, "active_today": today_active.count or 0, "messages_today": today_msgs.count or 0, "system": get_system_metrics()}

@app.websocket("/admin/live")
async def admin_live_ws(websocket: WebSocket, token: str = None):
    from fastapi.security import HTTPAuthorizationCredentials
    from langgraph_agent.utils.security import require_admin
    await websocket.accept()
    if not token: await websocket.close(code=1008); return
    try:
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        admin = await require_admin(creds)
    except Exception: await websocket.close(code=1008); return
    try:
        while True:
            from langgraph_agent.utils.gpu_queue import get_gpu_queue
            await websocket.send_json({
                "type": "metrics_update",
                "system": get_system_metrics(),
                "queue": get_gpu_queue().get_stats(),
                "state": get_app_state(),
                "timestamp": time.time()
            })
            await asyncio.sleep(2)
    except WebSocketDisconnect: pass
    except Exception as e:
        print(f"WS Error: {e}")
        try: await websocket.close(code=1011)
        except: pass

@app.post("/admin/users/{user_id}/ban")
async def admin_ban_user(user_id: str, request_body: BanRequest, request: Request, admin: Admin = Depends(require_admin)):
    check_admin_rate_limit(admin.id, tier="standard")
    from langgraph_agent.memory.store import get_supabase
    sb = get_supabase()
    try:
        if request_body.ban:
            sb.auth.admin.update_user_by_id(user_id, {"ban_duration": "876000h"})
            sb.table("user_bans").insert({"user_id": user_id, "banned_by": admin.id, "reason": request_body.reason}).execute()
        else: sb.auth.admin.update_user_by_id(user_id, {"ban_duration": "none"})
        log_admin_action(admin_user_id=admin.id, action="ban_user" if request_body.ban else "unban_user", target_type="user", target_id=user_id, justification=request_body.reason, ip_address=request.client.host if request.client else None, request_id=request.state.request_id)
        return {"success": True}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.post("/admin/users/{user_id}/role")
async def admin_change_role(user_id: str, request_body: RoleChangeRequest, request: Request, admin: Admin = Depends(require_admin)):
    check_admin_rate_limit(admin.id, tier="standard")
    from langgraph_agent.memory.store import get_supabase
    sb = get_supabase(); role = request_body.role
    if role not in ("user", "admin", "api_client"): raise HTTPException(status_code=400, detail="Invalid role")
    try:
        sb.table("user_roles").upsert({"user_id": user_id, "role": role}, on_conflict="user_id").execute()
        log_admin_action(admin_user_id=admin.id, action="change_role", target_type="user", target_id=user_id, metadata={"new_role": role}, ip_address=request.client.host if request.client else None, request_id=request.state.request_id)
        return {"success": True}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/admin/queue/status")
async def admin_queue_status(request: Request, admin: Admin = Depends(require_admin)):
    check_admin_rate_limit(admin.id, tier="heavy")
    from langgraph_agent.utils.gpu_queue import get_gpu_queue
    return get_gpu_queue().get_stats()

@app.get("/admin/conversations")
async def admin_list_conversations(request: Request, admin: Admin = Depends(require_admin), page: int = 1, limit: int = 50, search: Optional[str] = None, include_deleted: bool = False):
    check_admin_rate_limit(admin.id, tier="standard")
    from langgraph_agent.memory.store import get_supabase
    sb = get_supabase(); offset = (page - 1) * limit
    query = sb.table("chat_sessions").select("*", count="exact")
    if not include_deleted: query = query.is_("deleted_at", "null")
    if search: query = query.ilike("title", f"%{search}%")
    resp = query.order("updated_at", desc=True).range(offset, offset + limit - 1).execute()
    return {"data": resp.data or [], "count": resp.count or 0, "page": page, "limit": limit}

@app.delete("/admin/conversations/{session_id}")
async def admin_delete_conversation(session_id: str, request: Request, admin: Admin = Depends(require_admin)):
    check_admin_rate_limit(admin.id, tier="standard")
    from langgraph_agent.memory.store import get_supabase
    from datetime import datetime, timezone
    sb = get_supabase()
    try:
        sb.table("chat_sessions").update({"deleted_at": datetime.now(timezone.utc).isoformat(), "deleted_by": admin.id}).eq("id", session_id).execute()
        log_admin_action(admin_user_id=admin.id, action="soft_delete_conversation", target_type="chat_session", target_id=session_id, ip_address=request.client.host if request.client else None, request_id=request.state.request_id)
        return {"success": True}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.post("/admin/models/reload")
async def admin_reload_model(request: Request, admin: Admin = Depends(require_admin)):
    check_admin_rate_limit(admin.id, tier="heavy")
    from langgraph_agent.utils.gpu_queue import get_gpu_queue
    from langgraph_agent.utils.qwen_client import QwenClient
    queue = get_gpu_queue(); qwen = QwenClient()
    set_app_state("MAINTENANCE")
    wait_start = time.time()
    while queue.active_requests > 0:
        if time.time() - wait_start > 60: break
        await asyncio.sleep(1)
    try:
        success = await qwen.reload_model()
        if success:
            set_app_state("RUNNING")
            log_admin_action(admin_user_id=admin.id, action="reload_model", target_type="system", target_id="qwen3_vl", ip_address=request.client.host if request.client else None, request_id=request.state.request_id)
            return {"success": True, "state": "RUNNING"}
        else: raise Exception("Model reload returned False")
    except Exception as e:
        set_app_state("ERROR")
        try:
            await qwen.reload_model() 
            set_app_state("RUNNING")
            return {"success": False, "error": str(e), "state": "RECOVERED"}
        except:
            set_app_state("CRITICAL_ERROR")
            raise HTTPException(status_code=500, detail=f"Model reload failed and recovery failed: {e}")

@app.get("/admin/logs")
async def admin_get_audit_logs(request: Request, admin: Admin = Depends(require_admin), page: int = 1, limit: int = 50, action: Optional[str] = None):
    check_admin_rate_limit(admin.id, tier="standard")
    from langgraph_agent.memory.store import get_supabase
    sb = get_supabase(); offset = (page - 1) * limit
    query = sb.table("admin_audit_logs").select("*", count="exact")
    if action: query = query.eq("action", action)
    resp = query.order("timestamp", desc=True).range(offset, offset + limit - 1).execute()
    return {"data": resp.data or [], "count": resp.count or 0, "page": page, "limit": limit}

@app.get("/admin/analytics")
async def admin_analytics(request: Request, admin: Admin = Depends(require_admin), days: int = 14):
    check_admin_rate_limit(admin.id, tier="heavy")
    from langgraph_agent.memory.store import get_supabase
    from datetime import date, timedelta
    sb = get_supabase(); today = date.today(); start_date = today - timedelta(days=days)
    logs_resp = sb.table("chat_logs").select("created_at").gte("created_at", start_date.isoformat()).execute()
    usage_resp = sb.table("usage_tracking").select("date, user_id, request_count, token_count").gte("date", start_date.isoformat()).execute()
    sessions_resp = sb.table("chat_sessions").select("created_at").gte("created_at", start_date.isoformat()).execute()
    daily = {}
    for i in range(days + 1):
        d = (start_date + timedelta(days=i)).isoformat()
        daily[d] = {"date": d, "messages": 0, "active_users": 0, "tokens": 0, "sessions": 0}
    for log in (logs_resp.data or []):
        d = log["created_at"][:10]
        if d in daily: daily[d]["messages"] += 1
    for sess in (sessions_resp.data or []):
        d = sess["created_at"][:10]
        if d in daily: daily[d]["sessions"] += 1
    day_users = {}
    for row in (usage_resp.data or []):
        d = row["date"]
        if d not in day_users: day_users[d] = set()
        day_users[d].add(row["user_id"])
        if d in daily: daily[d]["tokens"] += row.get("token_count", 0)
    for d, users in day_users.items():
        if d in daily: daily[d]["active_users"] = len(users)
    return {"days": days, "data": sorted(daily.values(), key=lambda x: x["date"])}

# ============== Background Task Helpers (Merged) ==============

async def _export_data_worker(dataset: str, format: str, export_id: str):
    """Replacement for Celery task using BackgroundTasks"""
    try:
        from langgraph_agent.memory.store import get_supabase
        import json, csv, io
        sb = get_supabase()
        T_MAP = {"users": "user_roles", "sessions": "chat_sessions", "audit_logs": "admin_audit_logs", "usage": "usage_tracking"}
        table = T_MAP.get(dataset)
        if not table: return
        resp = sb.table(table).select("*").limit(10000).execute()
        rows = resp.data or []
        if format == "json": result = json.dumps(rows, default=str)
        else:
            output = io.StringIO()
            if rows:
                writer = csv.DictWriter(output, fieldnames=rows[0].keys())
                writer.writeheader()
                for r in rows: writer.writerow(r)
            result = output.getvalue()
        _EXPORT_RESULTS[export_id] = {"status": "completed", "data": result, "expiry": time.time() + 3600}
    except Exception as e:
        _EXPORT_RESULTS[export_id] = {"status": "error", "error": str(e), "expiry": time.time() + 3600}

@app.post("/admin/export/{dataset}/async")
async def admin_export_async(dataset: str, bg_tasks: BackgroundTasks, request: Request, admin: Admin = Depends(require_admin), format: str = "csv"):
    check_admin_rate_limit(admin.id, tier="heavy")
    _cleanup_exports()
    export_id = f"exp_{dataset}_{int(time.time())}"
    _EXPORT_RESULTS[export_id] = {"status": "pending", "expiry": time.time() + 600}
    bg_tasks.add_task(_export_data_worker, dataset, format, export_id)
    log_admin_action(admin_user_id=admin.id, action=f"export_{dataset}_async", target_type="system", target_id=dataset, metadata={"task_id": export_id}, ip_address=request.client.host if request.client else None, request_id=request.state.request_id)
    return {"task_id": export_id, "status": "pending"}

@app.get("/admin/export/tasks/{task_id}")
async def get_task_status(task_id: str, admin: Admin = Depends(require_admin)):
    res = _EXPORT_RESULTS.get(task_id)
    if not res: return {"task_id": task_id, "status": "NOT_FOUND"}
    return {"task_id": task_id, "status": res.get("status"), "result": {"export_id": task_id} if res.get("status") == "completed" else None}

@app.get("/admin/export/download/{export_id}")
async def download_export(export_id: str, admin: Admin = Depends(require_admin)):
    res = _EXPORT_RESULTS.get(export_id)
    if not res or res.get("status") != "completed": raise HTTPException(status_code=404, detail="Export not found")
    media = "application/json" if "json" in export_id else "text/csv"
    ext = "json" if "json" in export_id else "csv"
    return Response(content=res["data"], media_type=media, headers={"Content-Disposition": f"attachment; filename={export_id}.{ext}"})


@app.post("/admin/maintenance/cleanup")
async def admin_cleanup_logs(request: Request, admin: Admin = Depends(require_admin), days: int = 90):
    """Manually trigger cleanup of old audit logs"""
    check_admin_rate_limit(admin.id, tier="heavy")
    from langgraph_agent.memory.store import get_supabase
    from datetime import datetime, timedelta, timezone
    sb = get_supabase()
    threshold = datetime.now(timezone.utc) - timedelta(days=days)
    try:
        resp = sb.table("admin_audit_logs").delete().lt("timestamp", threshold.isoformat()).execute()
        count = len(resp.data) if resp.data else 0
        log_admin_action(admin_user_id=admin.id, action="cleanup_logs", target_type="system", target_id="audit_logs", metadata={"days": days, "cleaned_count": count}, ip_address=request.client.host if request.client else None, request_id=request.state.request_id)
        return {"success": True, "cleaned_count": count}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_excludes=["unsloth_compiled_cache", "**/__pycache__/*"]
    )
