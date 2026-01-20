# Conversation Memory Module
# Implements LangChain-style memory patterns for context management

import aiohttp
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime
import json


@dataclass
class Message:
    """Single conversation message"""
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)


class ConversationBufferMemory:
    """
    Basic buffer memory - stores all conversation history.
    Simple and effective for short conversations.
    
    Equivalent to LangChain's ConversationBufferMemory
    """
    
    def __init__(self):
        self.messages: List[Message] = []
        self.current_topic: Optional[str] = None
    
    def add_message(self, role: str, content: str, metadata: Dict = None):
        """Add a message to the buffer"""
        msg = Message(
            role=role,
            content=content,
            metadata=metadata or {}
        )
        self.messages.append(msg)
        
        # Extract topic from user messages
        if role == 'user' and len(content) > 10:
            self._extract_topic(content)
    
    def _extract_topic(self, content: str):
        """Extract potential topic/location from message"""
        # Simple heuristic: look for capitalized words
        words = content.split()
        for word in words:
            if word and len(word) > 3 and word[0].isupper():
                self.current_topic = word
                break
    
    def get_history(self) -> List[Dict]:
        """Get all messages as dict list"""
        return [{"role": m.role, "content": m.content} for m in self.messages]
    
    def get_formatted_history(self) -> str:
        """Get history as formatted string"""
        lines = []
        for msg in self.messages:
            role = "Người dùng" if msg.role == "user" else "Trợ lý"
            lines.append(f"{role}: {msg.content}")
        return "\n".join(lines)
    
    def clear(self):
        """Clear all messages"""
        self.messages = []
        self.current_topic = None


class ConversationBufferWindowMemory:
    """
    Window buffer memory - stores only last k messages.
    More efficient for long conversations.
    
    Equivalent to LangChain's ConversationBufferWindowMemory
    """
    
    def __init__(self, k: int = 6):
        self.k = k  # Number of messages to keep
        self.messages: List[Message] = []
        self.current_topic: Optional[str] = None
        self.topic_history: List[str] = []  # Track topics even when messages are pruned
    
    def add_message(self, role: str, content: str, metadata: Dict = None):
        """Add a message, keeping only last k messages"""
        msg = Message(
            role=role,
            content=content,
            metadata=metadata or {}
        )
        self.messages.append(msg)
        
        # Extract topic before pruning
        if role == 'user':
            topic = self._extract_topic(content)
            if topic:
                self.current_topic = topic
                if topic not in self.topic_history[-3:]:  # Keep last 3 unique topics
                    self.topic_history.append(topic)
        
        # Prune to keep only last k messages
        if len(self.messages) > self.k:
            self.messages = self.messages[-self.k:]
    
    def _extract_topic(self, content: str) -> Optional[str]:
        """Extract potential topic from message"""
        words = content.split()
        for word in words:
            if word and len(word) > 3 and word[0].isupper():
                return word
        return None
    
    def get_history(self) -> List[Dict]:
        """Get windowed messages as dict list"""
        return [{"role": m.role, "content": m.content} for m in self.messages]
    
    def get_current_topic(self) -> Optional[str]:
        """Get the current conversation topic"""
        return self.current_topic
    
    def get_recent_topics(self) -> List[str]:
        """Get recent topics discussed"""
        return self.topic_history[-5:]


class ConversationSummaryMemory:
    """
    Summary memory - stores a summary of conversation instead of raw messages.
    Saves tokens while maintaining context.
    
    Equivalent to LangChain's ConversationSummaryMemory
    """
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key
        self.summary: str = ""
        self.current_topic: Optional[str] = None
        self.message_count: int = 0
        self._pending_messages: List[Message] = []
    
    def add_message(self, role: str, content: str, metadata: Dict = None):
        """Add message - will trigger summary update after threshold"""
        msg = Message(role=role, content=content, metadata=metadata or {})
        self._pending_messages.append(msg)
        self.message_count += 1
        
        # Extract topic
        if role == 'user' and len(content) > 10:
            words = content.split()
            for word in words:
                if word and len(word) > 3 and word[0].isupper():
                    self.current_topic = word
                    break
    
    async def update_summary(self):
        """Update the conversation summary using LLM"""
        if not self._pending_messages or not self.api_key:
            return
        
        # Format pending messages
        new_messages = "\n".join([
            f"{'User' if m.role == 'user' else 'Bot'}: {m.content}"
            for m in self._pending_messages
        ])
        
        prompt = f"""Dựa vào summary hiện tại và các tin nhắn mới, hãy tạo bản tóm tắt ngắn gọn về cuộc hội thoại.

Summary hiện tại:
{self.summary or '(Chưa có)'}

Tin nhắn mới:
{new_messages}

Tạo bản tóm tắt mới (tối đa 3 câu), tập trung vào:
- Chủ đề chính đang thảo luận
- Thông tin quan trọng đã trao đổi
- Yêu cầu/mong muốn của user

Summary mới:"""

        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={self.api_key}"
            payload = {
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.3, "maxOutputTokens": 200}
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                        if text:
                            self.summary = text.strip()
                            self._pending_messages = []
                            print(f"📝 Summary updated: {self.summary[:100]}...")
        except Exception as e:
            print(f"Summary update failed: {e}")
    
    def get_summary(self) -> str:
        """Get current conversation summary"""
        return self.summary
    
    def get_context(self) -> Dict:
        """Get full context including summary and current topic"""
        return {
            "summary": self.summary,
            "current_topic": self.current_topic,
            "message_count": self.message_count
        }


class ConversationSummaryBufferMemory:
    """
    Hybrid memory - combines Summary and Buffer.
    Keeps recent messages in buffer, older messages as summary.
    
    Equivalent to LangChain's ConversationSummaryBufferMemory
    """
    
    def __init__(self, api_key: str = None, buffer_size: int = 4, summary_threshold: int = 8):
        self.api_key = api_key
        self.buffer_size = buffer_size
        self.summary_threshold = summary_threshold
        
        self.buffer: List[Message] = []  # Recent messages (raw)
        self.summary: str = ""  # Summary of older messages
        self.current_topic: Optional[str] = None
        self.entities: Dict[str, str] = {}  # Extracted entities
    
    def add_message(self, role: str, content: str, metadata: Dict = None):
        """Add message to buffer, summarize when threshold reached"""
        msg = Message(role=role, content=content, metadata=metadata or {})
        self.buffer.append(msg)
        
        # Extract topic and entities
        if role == 'user':
            self._extract_entities(content)
    
    def _extract_entities(self, content: str):
        """Extract named entities from content"""
        words = content.split()
        for i, word in enumerate(words):
            if word and len(word) > 3 and word[0].isupper():
                # Simple entity extraction
                self.current_topic = word
                
                # Check for location patterns
                location_keywords = ['biển', 'vịnh', 'núi', 'động', 'vườn', 'hồ', 'đảo', 'chùa', 'đền']
                for kw in location_keywords:
                    if kw in content.lower() and word not in self.entities:
                        self.entities[word] = 'location'
                        break
    
    async def consolidate(self):
        """Move old messages to summary when buffer is full"""
        if len(self.buffer) <= self.summary_threshold or not self.api_key:
            return
        
        # Messages to summarize (keep buffer_size recent messages)
        messages_to_summarize = self.buffer[:-self.buffer_size]
        self.buffer = self.buffer[-self.buffer_size:]
        
        # Generate summary of old messages
        old_text = "\n".join([
            f"{'User' if m.role == 'user' else 'Bot'}: {m.content[:200]}"
            for m in messages_to_summarize
        ])
        
        prompt = f"""Tóm tắt ngắn gọn cuộc hội thoại sau:

Summary cũ: {self.summary or '(không có)'}

Tin nhắn cần tóm tắt:
{old_text}

Tóm tắt mới (1-2 câu):"""

        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={self.api_key}"
            payload = {
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.3, "maxOutputTokens": 150}
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                        if text:
                            self.summary = text.strip()
                            print(f"📝 Buffer consolidated: {len(messages_to_summarize)} messages → summary")
        except Exception as e:
            print(f"Consolidation failed: {e}")
    
    def get_context_for_prompt(self) -> str:
        """Get full context: summary + recent buffer"""
        parts = []
        
        if self.summary:
            parts.append(f"[Tóm tắt hội thoại trước]: {self.summary}")
        
        if self.current_topic:
            parts.append(f"[Chủ đề hiện tại]: {self.current_topic}")
        
        if self.entities:
            entities_str = ", ".join([f"{k} ({v})" for k, v in list(self.entities.items())[-5:]])
            parts.append(f"[Thực thể đã đề cập]: {entities_str}")
        
        if self.buffer:
            parts.append("[Tin nhắn gần đây]:")
            for msg in self.buffer[-4:]:
                role = "User" if msg.role == "user" else "Bot"
                parts.append(f"  {role}: {msg.content[:200]}")
        
        return "\n".join(parts)
    
    def get_history(self) -> List[Dict]:
        """Get buffer messages as dict list"""
        return [{"role": m.role, "content": m.content} for m in self.buffer]


# Export memory classes
__all__ = [
    'Message',
    'ConversationBufferMemory',
    'ConversationBufferWindowMemory', 
    'ConversationSummaryMemory',
    'ConversationSummaryBufferMemory'
]
