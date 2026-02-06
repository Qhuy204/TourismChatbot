# Memory System
from .extractor import extract_facts, ExtractedFact, FactType
from .validator import validate_facts, validate_fact
from .store import store_facts, get_user_memory, clear_user_memory, log_chat, log_event

__all__ = [
    # Extractor
    "extract_facts",
    "ExtractedFact",
    "FactType",
    
    # Validator
    "validate_facts",
    "validate_fact",
    
    # Store
    "store_facts",
    "get_user_memory",
    "clear_user_memory",
    "log_chat",
    "log_event",
]


async def memory_pipeline(
    user_id: str,
    message: str,
    history: list = None
) -> tuple[bool, int]:
    """
    Full memory pipeline: Extract → Validate → Store.
    Called on every message to capture long-term facts.
    
    Returns:
        (memory_updated, facts_stored)
    """
    # 1. Extract facts from message
    facts = await extract_facts(message, history)
    
    if not facts:
        return False, 0
    
    # 2. Validate facts
    valid_facts = validate_facts(facts)
    
    if not valid_facts:
        return False, 0
    
    # 3. Store valid facts
    stored = await store_facts(user_id, valid_facts)
    
    return stored > 0, stored
