"""
LangGraph State Objects
Split into 3 focused dataclasses to prevent state bloat
"""
from dataclasses import dataclass, field
from typing import List, Dict, Literal, Optional
from enum import Enum


class IntentType(str, Enum):
    """Intent categories for routing"""
    TRAVEL_QUERY = "travel_query"
    CHIT_CHAT = "chit_chat"
    PREFERENCE_UPDATE = "preference_update"
    NEGATIVE_FEEDBACK = "negative_feedback"
    META_INSTRUCTION = "meta_instruction"


class EmotionType(str, Enum):
    """Detected user emotions"""
    CALM = "calm"
    EXCITED = "excited"
    CURIOUS = "curious"
    FRUSTRATED = "frustrated"
    NEUTRAL = "neutral"


@dataclass
class UserContextState:
    """
    Cached user profile information.
    Loaded once and cached for 30 minutes.
    """
    user_id: str
    session_id: str
    
    # User preferences (from DB)
    preferred_cities: List[str] = field(default_factory=list)
    travel_style: str = ""
    budget_range: str = ""
    
    # Behavioral data
    recent_searches: List[str] = field(default_factory=list)
    interests: List[str] = field(default_factory=list)
    
    # Cache metadata
    cached_at: Optional[float] = None
    
    def is_cache_valid(self, ttl_seconds: int = 1800) -> bool:
        """Check if cache is still valid (default 30 min)"""
        if self.cached_at is None:
            return False
        import time
        return (time.time() - self.cached_at) < ttl_seconds


@dataclass
class MessageProcessingState:
    """
    Per-message processing state.
    Created fresh for each incoming message.
    """
    # Input
    message: str
    history: List[Dict] = field(default_factory=list)
    
    # Context management (ChatGPT-like)
    conversation_summary: str = ""
    recent_turns: List[Dict] = field(default_factory=list)
    
    # Processing results
    intent: IntentType = IntentType.TRAVEL_QUERY
    intent_confidence: float = 0.0
    
    emotion: EmotionType = EmotionType.NEUTRAL
    emotion_confidence: float = 0.0
    
    rewritten_query: str = ""
    rewrite_method: Literal["skip", "rule", "llm"] = "skip"
    
    is_relevant: bool = True
    relevance_reason: str = ""
    
    model_mode: Literal["gemini", "qwen"] = "gemini"
    
    # Retrieved context
    retrieved_context: List[Dict] = field(default_factory=list)
    
    # Debug info
    processing_time_ms: float = 0.0


@dataclass
class OutputState:
    """
    Response and output data.
    Contains the final response and suggestions.
    """
    # Main response
    response: str = ""
    response_tone: str = ""
    
    # Suggestions (categorized)
    suggested_prompts: List[Dict] = field(default_factory=list)
    # Format: [{"text": "...", "category": "next_step|personalized|open_ended"}]
    
    # Memory updates
    memory_updated: bool = False
    memory_facts_stored: int = 0
    
    # Metadata
    model_used: str = ""
    total_tokens: int = 0
    
    # Debug
    debug_info: Dict = field(default_factory=dict)


@dataclass
class AgentState:
    """
    Combined state for LangGraph.
    Aggregates all three state objects for graph processing.
    """
    user_context: UserContextState
    processing: MessageProcessingState
    output: OutputState
    
    @classmethod
    def create(
        cls,
        user_id: str,
        session_id: str,
        message: str,
        history: List[Dict] = None
    ) -> "AgentState":
        """Factory method to create new agent state"""
        return cls(
            user_context=UserContextState(
                user_id=user_id,
                session_id=session_id
            ),
            processing=MessageProcessingState(
                message=message,
                history=history or []
            ),
            output=OutputState()
        )
