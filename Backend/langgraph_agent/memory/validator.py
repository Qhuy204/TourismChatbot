"""
Memory Validator
Validates extracted facts before storing
"""
from typing import List
from .extractor import ExtractedFact, ALLOWED_KEYS


# Validation configuration
MIN_CONFIDENCE = 0.5
MAX_VALUE_LENGTH = 200

# Privacy-sensitive keys (require higher confidence)
SENSITIVE_KEYS = ["personal_info", "dietary_restrictions"]
SENSITIVE_MIN_CONFIDENCE = 0.8


def validate_key(fact: ExtractedFact) -> bool:
    """Check if key is in allowed list"""
    return fact.key in ALLOWED_KEYS


def validate_value(fact: ExtractedFact) -> bool:
    """Check if value is valid"""
    if not fact.value:
        return False
    if len(fact.value) > MAX_VALUE_LENGTH:
        return False
    if len(fact.value) < 2:
        return False
    return True


def validate_confidence(fact: ExtractedFact) -> bool:
    """Check confidence threshold"""
    threshold = MIN_CONFIDENCE
    
    # Higher threshold for sensitive data
    if fact.key in SENSITIVE_KEYS:
        threshold = SENSITIVE_MIN_CONFIDENCE
    
    return fact.confidence >= threshold


def validate_privacy(fact: ExtractedFact) -> bool:
    """Filter out privacy-sensitive information"""
    value_lower = fact.value.lower()
    
    # Block PII patterns
    pii_patterns = [
        "@",           # Email
        "0",           # Phone (starts with 0 in VN)
        "số điện thoại",
        "email",
        "địa chỉ",
        "số nhà",
    ]
    
    for pattern in pii_patterns:
        if pattern in value_lower:
            return False
    
    return True


def validate_fact(fact: ExtractedFact) -> tuple[bool, str]:
    """
    Validate a single fact.
    Returns (is_valid, reason)
    """
    if not validate_key(fact):
        return False, f"key_not_allowed: {fact.key}"
    
    if not validate_value(fact):
        return False, "invalid_value"
    
    if not validate_confidence(fact):
        return False, f"low_confidence: {fact.confidence}"
    
    if not validate_privacy(fact):
        return False, "privacy_violation"
    
    return True, "valid"


def validate_facts(facts: List[ExtractedFact]) -> List[ExtractedFact]:
    """
    Validate list of facts, return only valid ones
    """
    valid_facts = []
    
    for fact in facts:
        is_valid, reason = validate_fact(fact)
        if is_valid:
            valid_facts.append(fact)
        else:
            print(f"Fact rejected: {fact.key}={fact.value} - {reason}")
    
    return valid_facts
