-- Migration: Create chat_sessions table for managing conversation history
-- This table stores chat session metadata for users to view and manage their conversations

CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Cuộc hội thoại mới',
    first_message TEXT, -- Store first message for reference
    message_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Index for fast user session lookup
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(user_id, updated_at DESC);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_chat_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER trigger_chat_sessions_updated_at
    BEFORE UPDATE ON chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_sessions_updated_at();

-- RLS Policies
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions
DROP POLICY IF EXISTS "Users can view own sessions" ON chat_sessions;
CREATE POLICY "Users can view own sessions" ON chat_sessions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own sessions
DROP POLICY IF EXISTS "Users can create own sessions" ON chat_sessions;
CREATE POLICY "Users can create own sessions" ON chat_sessions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions
DROP POLICY IF EXISTS "Users can update own sessions" ON chat_sessions;
CREATE POLICY "Users can update own sessions" ON chat_sessions
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own sessions
DROP POLICY IF EXISTS "Users can delete own sessions" ON chat_sessions;
CREATE POLICY "Users can delete own sessions" ON chat_sessions
    FOR DELETE
    USING (auth.uid() = user_id);

-- Add session_id foreign key to chat_logs if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_logs' AND column_name = 'session_id'
    ) THEN
        ALTER TABLE chat_logs ADD COLUMN session_id TEXT;
    END IF;
END $$;

-- Index on chat_logs.session_id for fast message lookup
CREATE INDEX IF NOT EXISTS idx_chat_logs_session_id ON chat_logs(session_id);
