-- Migration: Chat UI Enhancements
-- Add columns for pin feature and attachment persistence

-- 1. Add is_pinned column to chat_sessions for pin functionality
ALTER TABLE chat_sessions 
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;

-- 2. Add attachments column to chat_logs for persistent image/file storage
ALTER TABLE chat_logs 
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- Add index for pinned sessions (sorted first)
CREATE INDEX IF NOT EXISTS idx_chat_sessions_pinned 
ON chat_sessions(user_id, is_pinned DESC, updated_at DESC);
