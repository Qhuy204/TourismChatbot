try:
    import unsloth
except ImportError:
    pass
import os
import json
from contextlib import asynccontextmanager
from typing import List, Dict, Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
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
    attachments: Optional[List[Dict]] = None  # [{url, type, name}]


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


class ContextualSuggestionsRequest(BaseModel):
    """Request for AI-generated contextual suggestions based on recent locations"""
    locations: List[str]  # Recent locations from response
    last_question: Optional[str] = None  # User's last question for context
    user_messages: Optional[List[str]] = []  # Recent user messages for style mimicry
    limit: int = 4


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
        
    from langgraph_agent.graph import run_graph_stream
    
    async def event_generator():
        try:
            async for chunk in run_graph_stream(
                user_id=request.user_id,
                session_id=request.session_id,
                message=request.message,
                history=request.history,
                model_mode=request.model_mode,
                attachments=request.attachments
            ):
                yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
        except Exception as e:
            print(f"Streaming error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


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
    
    # Default suggestions for new users
    default_data = {
        "welcome_message": "Xin chào! Tôi có thể giúp gì cho chuyến du lịch của bạn?",
        "suggestions": [
            {"text": "Địa điểm du lịch hot nhất 2026", "category": "trending"},
            {"text": "Gợi ý du lịch biển đẹp", "category": "discovery"},
            {"text": "Lịch trình Đà Nẵng 3 ngày", "category": "itinerary"},
            {"text": "Ẩm thực đường phố Hà Nội", "category": "food"},
            {"text": "Cẩm nang du lịch trải nghiệm", "category": "tips"}
        ]
    }
    
    if not all_interests and not preferred_cities:
        return default_data
    
    try:
        # Build context string from interests
        interest_str = ", ".join(all_interests[:5])
        city_str = ", ".join(preferred_cities[:3]) if preferred_cities else ""
        recent_loc_str = ", ".join(recent_locations[:3]) if recent_locations else ""
        
        prompt = f"""Bạn là trợ lý du lịch AI thông minh. 
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
    user_messages: Optional[List[str]] = []
    limit: int = 4

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
            samples = "\n".join([f'- "{msg}"' for msg in request.user_messages[-5:]])
            style_instruction = f"""
PHONG CÁCH CỦA USER (Hãy bắt chước tone giọng này):
{samples}
- Nếu user dùng từ đệm "nhỉ", "ha" -> Dùng 1 chút cho tự nhiên, NHƯNG KHÔNG LẠM DỤNG.
- Nếu user hỏi ngắn gọn -> Hãy hỏi ngắn, trực diện.
"""

        prompt = f"""{locations_str}{context_hint}
{style_instruction}

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


@app.post("/langgraph/recommendations")
async def get_question_recommendations(request: RecommendationsRequest):
    from langgraph_agent.memory.store import get_recommendations
    
    recommendations = await get_recommendations(
        user_id=request.user_id,
        topics=request.topics,
        limit=request.limit
    )
    return {"recommendations": recommendations}



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_excludes=["unsloth_compiled_cache", "**/__pycache__/*"]
    )
