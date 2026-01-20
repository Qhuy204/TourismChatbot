# RAG Pipeline Configuration
# Part of new RAG architecture to fix context switching

from typing import List

# ===== AFFIRMATIVE WORDS =====
# Short follow-up words that should NOT trigger new retrieval
AFFIRMATIVE_WORDS: List[str] = [
    # Vietnamese affirmations
    'có', 'ok', 'ừ', 'ừm', 'ưm', 'vâng', 'được', 'đồng ý', 'tiếp', 'tiếp tục',
    'gợi ý đi', 'cho xem', 'cho tôi xem', 'nói tiếp', 'kể thêm', 'nói đi',
    'rồi', 'đúng', 'đúng rồi', 'phải', 'chính xác', 'hay', 'hay đấy',
    'yes', 'yeah', 'yep', 'sure', 'go ahead', 'continue', 'okay',
    'tiếp đi', 'nói thêm', 'chi tiết hơn', 'thêm', 'còn gì nữa',
    'muốn', 'muốn biết', 'cho biết', 'cho mình biết'
]

# Short generic follow-ups that need context
SHORT_FOLLOWUPS: List[str] = [
    'thế còn', 'còn gì', 'gì nữa', 'sao nữa', 'rồi sao', 'thêm đi',
    'ở đâu', 'bao nhiêu', 'khi nào', 'như thế nào', 'làm sao'
]

# Gemini model settings
GEMINI_REWRITE_MODEL = "gemini-2.0-flash"
GEMINI_GENERATE_MODEL = "gemini-2.0-flash"
REWRITE_TEMPERATURE = 0.3
REWRITE_MAX_TOKENS = 100
