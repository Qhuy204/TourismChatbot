# RAG Module - New Architecture for Context-Aware Chatbot
from .config import AFFIRMATIVE_WORDS, SHORT_FOLLOWUPS
from .query_rewriter import rewrite_query, is_affirmative, is_short_followup
from .pipeline import process_rag_query, build_enhanced_prompt
from .memory import (
    ConversationBufferMemory,
    ConversationBufferWindowMemory,
    ConversationSummaryMemory,
    ConversationSummaryBufferMemory
)

__all__ = [
    'AFFIRMATIVE_WORDS',
    'SHORT_FOLLOWUPS',
    'rewrite_query',
    'is_affirmative',
    'is_short_followup',
    'process_rag_query',
    'build_enhanced_prompt',
    # Memory classes
    'ConversationBufferMemory',
    'ConversationBufferWindowMemory',
    'ConversationSummaryMemory',
    'ConversationSummaryBufferMemory'
]
