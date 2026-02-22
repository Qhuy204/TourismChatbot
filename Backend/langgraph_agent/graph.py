"""
LangGraph State Machine
Assembles all nodes into a coherent graph with routing
"""
import time
import asyncio
from typing import TypedDict, Annotated, List, Dict
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages

from .state import (
    AgentState, UserContextState, MessageProcessingState, 
    OutputState, IntentType
)
from .nodes import (
    prepare_context, classify_intent, detect_emotion,
    load_user_profile, rewrite_query, check_relevance,
    retrieve_context, generate_response, generate_suggestions,
    generate_response_stream
)
from .nodes.evaluator import evaluate_response
from .nodes.location_extractor import extract_locations, store_locations
from .memory import memory_pipeline, log_chat


# =============================================================================
# Graph State (TypedDict for LangGraph)
# =============================================================================

class GraphState(TypedDict):
    """State passed through the graph"""
    # Input
    user_id: str
    session_id: str
    message: str
    history: List[Dict]
    
    # User context
    user_context: UserContextState
    
    # Processing
    processing: MessageProcessingState
    
    # Output
    output: OutputState
    
    # Configuration
    model_mode: str


# =============================================================================
# Helpers
# =============================================================================

async def perform_auto_titling(session_id: str, message: str, response: str, history: List[Dict], model_mode: str) -> str:
    """Helper to generate and store a title for a session if it's new"""
    try:
        from .utils.gemini_client import gemini_fast
        from .utils.qwen_client import qwen_client
        from .memory.store import get_supabase
        client = get_supabase()
        if not client: return None
        
        # Check if session needs titling
        res = client.table("chat_sessions").select("title").eq("id", session_id).execute()
        if not res.data: return None
        
        current_title = res.data[0].get("title", "")
        default_titles = ["Cuộc hội thoại mới", "Cuộc trò chuyện mới", "New Chat", "Untitled", "Hội thoại du lịch"]
        
        if any(t in current_title for t in default_titles) or not current_title:
            # Build context (keep it simple for speed)
            context_str = ""
            # Last few turns are enough for titling
            for m in history[-2:]:
                role = "User" if m['role'] == 'user' else "Assistant"
                context_str += f"{role}: {m['content']}\n"
            context_str += f"User: {message}\nAssistant: {response}"
            
            title_prompt = (
                f"Tạo tiêu đề cực ngắn (2-4 từ) cho cuộc trò chuyện sau. Chỉ trả về text tiêu đề:\n\n{context_str}"
            )
            
            if model_mode == "qwen":
                title = await qwen_client.generate(title_prompt)
            else:
                title = await gemini_fast.generate(title_prompt)
            
            new_title = title.strip().strip('"').strip("'").strip("*")
            if new_title and len(new_title) < 50:
                client.table("chat_sessions").update({
                    "title": new_title,
                    "first_message": message[:100]
                }).eq("id", session_id).execute()
                return new_title
    except Exception as e:
        print(f"⚠️ Auto-titling helper error: {e}")
    return None

# =============================================================================
# Node Wrappers (adapt our nodes to graph state)
# =============================================================================

async def node_init(state: GraphState) -> GraphState:
    """Initialize state objects"""
    state["user_context"] = UserContextState(
        user_id=state["user_id"],
        session_id=state["session_id"]
    )
    mode = state.get("model_mode") or "gemini"
    print(f"📍 Node Init: session={state['session_id']} | mode_in_state={state.get('model_mode')} | using_mode={mode}")
    state["processing"] = MessageProcessingState(
        message=state["message"],
        history=state.get("history", []),
        model_mode=mode,
        attachments=state.get("attachments", [])
    )
    state["output"] = OutputState()
    return state


async def node_context(state: GraphState) -> GraphState:
    """Prepare context (summarization)"""
    state["processing"] = await prepare_context(state["processing"])
    return state


async def node_intent(state: GraphState) -> GraphState:
    """Classify intent"""
    state["processing"] = await classify_intent(state["processing"])
    return state


async def node_emotion(state: GraphState) -> GraphState:
    """Detect emotion"""
    state["processing"] = await detect_emotion(state["processing"])
    return state


async def node_profile(state: GraphState) -> GraphState:
    """Load user profile"""
    state["user_context"] = await load_user_profile(state["user_context"])
    return state


async def node_rewrite(state: GraphState) -> GraphState:
    """Rewrite query"""
    state["processing"] = await rewrite_query(state["processing"])
    return state


async def node_guard(state: GraphState) -> GraphState:
    """Check relevance"""
    state["processing"] = await check_relevance(state["processing"])
    return state


async def node_retrieve(state: GraphState) -> GraphState:
    """Retrieve context from VQA store"""
    state["processing"] = await retrieve_context(state["processing"])
    return state


async def node_generate(state: GraphState) -> GraphState:
    """Generate response"""
    state["output"] = await generate_response(
        processing_state=state["processing"],
        user_context=state["user_context"],
        output_state=state["output"]
    )
    return state


async def node_memory(state: GraphState) -> GraphState:
    """Run memory pipeline"""
    updated, count = await memory_pipeline(
        user_id=state["user_id"],
        message=state["message"],
        history=state.get("history", [])
    )
    state["output"].memory_updated = updated
    state["output"].memory_facts_stored = count
    return state


async def node_suggestions(state: GraphState) -> GraphState:
    """Generate suggestions"""
    state["output"] = await generate_suggestions(
        processing_state=state["processing"],
        user_context=state["user_context"],
        output_state=state["output"]
    )
    return state


# =============================================================================
# Routing Logic
# =============================================================================

def route_after_intent(state: GraphState) -> str:
    """Route based on intent classification"""
    intent = state["processing"].intent
    
    if intent == IntentType.CHIT_CHAT:
        return "generate"  # Skip RAG for chit-chat
    elif intent == IntentType.NEGATIVE_FEEDBACK:
        return "generate"  # Direct response
    else:
        return "parallel"  # Full processing


def route_after_guard(state: GraphState) -> str:
    """Route based on relevance check"""
    if state["processing"].is_relevant:
        return "retrieve"
    else:
        return "generate"  # Skip RAG for off-topic


# =============================================================================
# Graph Builder
# =============================================================================

def build_graph() -> StateGraph:
    """Build the LangGraph state machine"""
    
    # Create graph
    graph = StateGraph(GraphState)
    
    # Add nodes
    graph.add_node("init", node_init)
    graph.add_node("context", node_context)
    graph.add_node("intent", node_intent)
    graph.add_node("emotion", node_emotion)
    graph.add_node("profile", node_profile)
    graph.add_node("rewrite", node_rewrite)
    graph.add_node("guard", node_guard)
    graph.add_node("retrieve", node_retrieve)
    graph.add_node("generate", node_generate)
    graph.add_node("memory", node_memory)
    graph.add_node("suggestions", node_suggestions)
    
    # Set entry point
    graph.set_entry_point("init")
    
    # Add edges
    graph.add_edge("init", "context")
    graph.add_edge("context", "intent")
    
    # Conditional routing after intent
    graph.add_conditional_edges(
        "intent",
        route_after_intent,
        {
            "parallel": "emotion",
            "generate": "generate"
        }
    )
    
    # Parallel-ish flow (sequential for simplicity)
    graph.add_edge("emotion", "profile")
    graph.add_edge("profile", "rewrite")
    graph.add_edge("rewrite", "guard")
    
    # Conditional routing after guard
    graph.add_conditional_edges(
        "guard",
        route_after_guard,
        {
            "retrieve": "retrieve",
            "generate": "generate"
        }
    )
    
    graph.add_edge("retrieve", "generate")
    graph.add_edge("generate", "memory")
    graph.add_edge("memory", "suggestions")
    graph.add_edge("suggestions", END)
    
    return graph


# =============================================================================
# Compiled Graph (singleton)
# =============================================================================

_compiled_graph = None


def get_graph():
    """Get or create compiled graph"""
    global _compiled_graph
    if _compiled_graph is None:
        graph = build_graph()
        _compiled_graph = graph.compile()
    return _compiled_graph


async def run_graph(
    user_id: str,
    session_id: str,
    message: str,
    history: List[Dict] = None,
    model_mode: str = "gemini"
) -> Dict:
    """
    Run the full graph pipeline.
    Returns final output state.
    """
    graph = get_graph()
    
    # Track timing for evaluation
    start_time = time.time()
    
    # Prepare initial state
    initial_state: GraphState = {
        "user_id": user_id,
        "session_id": session_id,
        "message": message,
        "history": history or [],
        "user_context": None,
        "processing": None,
        "output": None,
        "model_mode": model_mode
    }
    
    # Run graph
    final_state = await graph.ainvoke(initial_state)
    
    # Extract output
    output = final_state.get("output", OutputState())
    processing = final_state.get("processing", MessageProcessingState(message=message))
    
    # Prepare debug dict
    final_debug = {
        "rewrite_method": processing.rewrite_method,
        "is_relevant": processing.is_relevant,
        "context_count": len(processing.retrieved_context),
        "model_used": output.model_used,
        **output.debug_info
    }
    
    # Run post-processing
    final_locations = []
    try:
        # 1. NEW: Extract locations from both message and response
        try:
            from .nodes.location_extractor import extract_locations, store_locations
            combined_text = f"User asked: {message}\nBot responded: {output.response}"
            loc_objects = await extract_locations(combined_text)
            final_locations = [vars(l) for l in loc_objects]
        except Exception as e:
            print(f"⚠️ Location extraction for response failed: {e}")

        # 2. Titling (from message 1 onwards)
        new_title = await perform_auto_titling(session_id, message, output.response, history, model_mode)

        async def run_remaining_tasks():
            # Run other background tasks
            tasks = [
                log_chat(
                    user_id=user_id,
                    session_id=session_id,
                    message=message,
                    response=output.response,
                    emotion=processing.emotion.value if processing.emotion else "neutral",
                    intent=processing.intent.value if processing.intent else "travel_query",
                    debug=final_debug,
                    attachments=processing.attachments
                ),
                evaluate_response(
                    processing_state=processing,
                    output_state=output,
                    start_time=start_time,
                    session_id=session_id
                )
            ]
            
            # Store extracted locations if any
            if 'loc_objects' in locals() and loc_objects:
                tasks.append(store_locations(loc_objects))
                
            await asyncio.gather(*tasks, return_exceptions=True)
        
        # Launch remaining post-processing in background
        asyncio.create_task(run_remaining_tasks())
        
    except Exception as e:
        print(f"Background orchestrator error: {e}")
        
    return {
        "response": output.response,
        "suggested_prompts": output.suggested_prompts,
        "emotion_detected": processing.emotion.value if processing.emotion else "neutral",
        "intent": processing.intent.value if processing.intent else "travel_query",
        "memory_updated": output.memory_updated,
        "memory_facts_stored": output.memory_facts_stored,
        "new_title": new_title,
        "debug": final_debug,
        "extracted_locations": final_locations
    }


async def run_graph_stream(
    user_id: str,
    session_id: str,
    message: str,
    history: List[Dict] = None,
    model_mode: str = "gemini",
    attachments: List[Dict] = None
):
    """
    Streamed version of run_graph.
    Yields chunks for SSE.
    """
    import time
    timings = {}
    total_start = time.time()
    
    # 1. Init & Sync Nodes
    graph = get_graph()
    state: GraphState = {
        "user_id": user_id,
        "session_id": session_id,
        "message": message,
        "history": history or [],
        "user_context": None,
        "processing": None,
        "output": None,
        "model_mode": model_mode,
        "attachments": attachments or []
    }
    
    # Run setup nodes manually with timing
    t0 = time.time()
    state = await node_init(state)
    timings["init"] = round((time.time() - t0) * 1000)
    
    t0 = time.time()
    state = await node_context(state)
    timings["context"] = round((time.time() - t0) * 1000)
    
    t0 = time.time()
    state = await node_intent(state)
    timings["intent"] = round((time.time() - t0) * 1000)
    
    intent = state["processing"].intent
    if intent not in [IntentType.CHIT_CHAT, IntentType.NEGATIVE_FEEDBACK]:
        t0 = time.time()
        state = await node_emotion(state)
        timings["emotion"] = round((time.time() - t0) * 1000)
        
        t0 = time.time()
        state = await node_profile(state)
        timings["profile"] = round((time.time() - t0) * 1000)
        
        t0 = time.time()
        state = await node_rewrite(state)
        timings["rewrite"] = round((time.time() - t0) * 1000)
        
        t0 = time.time()
        state = await node_guard(state)
        timings["guard"] = round((time.time() - t0) * 1000)
        
        if state["processing"].is_relevant:
            t0 = time.time()
            state = await node_retrieve(state)
            timings["retrieve"] = round((time.time() - t0) * 1000)
    
    # Yield initial metadata
    yield {
        "type": "metadata",
        "intent": state["processing"].intent.value if state["processing"].intent else "travel_query",
        "emotion": state["processing"].emotion.value if state["processing"].emotion else "neutral"
    }

    # 2. Stream Generation with timing
    t0 = time.time()
    full_response = ""
    async for chunk in generate_response_stream(state["processing"], state["user_context"]):
        # Safety check: Prevent infinite loops of numbers or repeated chars
        if len(chunk) > 100 and (chunk.isdigit() or len(set(chunk)) < 5):
            print("⚠️ Detected infinite loop pattern in generation, stopping stream.")
            break
            
        full_response += chunk
        yield {"type": "content", "content": chunk}
    timings["generate"] = round((time.time() - t0) * 1000)

    # 3. Post-processing
    state["output"].response = full_response
    
    t0 = time.time()
    state = await node_suggestions(state)
    timings["suggestions"] = round((time.time() - t0) * 1000)
    
    # FAST EXTRACTION for UI responsiveness
    t0 = time.time()
    final_locations = []
    new_title = None
    combined_text = f"User asked: {message}\nBot responded: {full_response}"
    
    try:
        from .nodes.location_extractor import fast_extract_locations
        fast_locs = fast_extract_locations(combined_text)
        # Convert to format expected by frontend/store
        final_locations = [{"name": l["name"], "province": l["name"] if l["type"] == "province" else None} for l in fast_locs]
    except Exception as e:
        print(f"Fast extraction failed: {e}")
        
    timings["fast_extract"] = round((time.time() - t0) * 1000)
    
    # 2. Titling (from message 1 onwards)
    new_title = await perform_auto_titling(session_id, message, full_response, history or [], model_mode)

    # Run memory & background tasks (Deep Extraction, Logging)
    async def run_bg():
        await node_memory(state)
        
        # Deep AI Extraction & Store (Slow)
        try:
            from .nodes.location_extractor import extract_locations, store_locations
            loc_objects = await extract_locations(combined_text)
            if loc_objects:
                await store_locations(loc_objects)
        except Exception as e:
            print(f"Bg extraction error: {e}")
            
        from .memory import log_chat
        await log_chat(
            user_id=user_id,
            session_id=session_id,
            message=message,
            response=full_response,
            emotion=state["processing"].emotion.value if state["processing"].emotion else "neutral",
            intent=state["processing"].intent.value if state["processing"].intent else "travel_query",
            attachments=state["processing"].attachments
        )
    
    asyncio.create_task(run_bg())

    # Print timing summary
    total_time = round((time.time() - total_start) * 1000)
    timing_str = " | ".join([f"{k}={v}ms" for k, v in timings.items()])
    print(f"⏱️ TIMING: {timing_str} | TOTAL={total_time}ms")

    yield {
        "type": "final",
        "suggested_prompts": state["output"].suggested_prompts,
        "memory_updated": state["output"].memory_updated,
        "extracted_locations": final_locations,
        "new_title": new_title
    }
