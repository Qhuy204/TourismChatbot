-- Create chat_logs table for storing chatbot conversations
-- Used for training data collection and conversation history

CREATE TABLE IF NOT EXISTS chat_logs (
    id BIGSERIAL PRIMARY KEY,

    -- User identification
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Session tracking (group messages in a conversation)
    session_id UUID NOT NULL,

    -- Message content
    role VARCHAR(20) NOT NULL,        -- 'user' or 'assistant'
    message TEXT NOT NULL,            -- The actual message content

    -- Context used for RAG (what data was retrieved)
    context JSONB,                    -- {"locations": [...], "user_interests": [...], "recent_views": [...]}

    -- Model information
    model_used VARCHAR(100),          -- gemini-2.5-flash, etc.
    response_time_ms INTEGER,         -- How long the response took

    -- User feedback for training
    feedback_score INTEGER,           -- -1 (thumbs down), 0 (no feedback), 1 (thumbs up)

    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_chat_logs_user_id ON chat_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_session_id ON chat_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_created_at ON chat_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_logs_feedback ON chat_logs(feedback_score) WHERE feedback_score IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own messages
CREATE POLICY "Users can insert own chat logs" ON chat_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can read their own chat history
CREATE POLICY "Users can read own chat logs" ON chat_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can update feedback on their own messages
CREATE POLICY "Users can update own chat feedback" ON chat_logs
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can read all chat logs (for training)
CREATE POLICY "Admins can read all chat logs" ON chat_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );
