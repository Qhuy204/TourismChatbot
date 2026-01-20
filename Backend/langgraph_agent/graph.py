"""
LangGraph State Machine
Assembles all nodes into a coherent graph with routing
"""
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
    retrieve_context, generate_response, generate_suggestions
)
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


# =============================================================================
# Node Wrappers (adapt our nodes to graph state)
# =============================================================================

async def node_init(state: GraphState) -> GraphState:
    """Initialize state objects"""
    state["user_context"] = UserContextState(
        user_id=state["user_id"],
        session_id=state["session_id"]
    )
    state["processing"] = MessageProcessingState(
        message=state["message"],
        history=state.get("history", [])
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
    history: List[Dict] = None
) -> Dict:
    """
    Run the full graph pipeline.
    Returns final output state.
    """
    graph = get_graph()
    
    # Prepare initial state
    initial_state: GraphState = {
        "user_id": user_id,
        "session_id": session_id,
        "message": message,
        "history": history or [],
        "user_context": None,
        "processing": None,
        "output": None
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
    
    # Run logging in background (no await needed for fire-and-forget or async call)
    try:
        import asyncio
        asyncio.create_task(log_chat(
            user_id=user_id,
            session_id=session_id,
            message=message,
            response=output.response,
            emotion=processing.emotion.value if processing.emotion else "neutral",
            intent=processing.intent.value if processing.intent else "travel_query",
            debug=final_debug
        ))
    except Exception as e:
        print(f"Logging error: {e}")
        
    return {
        "response": output.response,
        "suggested_prompts": output.suggested_prompts,
        "emotion_detected": processing.emotion.value if processing.emotion else "neutral",
        "intent": processing.intent.value if processing.intent else "travel_query",
        "memory_updated": output.memory_updated,
        "memory_facts_stored": output.memory_facts_stored,
        "debug": final_debug
    }
