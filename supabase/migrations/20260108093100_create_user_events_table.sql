-- Create user_events table for tracking user behavior
-- This table is production-ready for recommender systems and chatbot context

CREATE TABLE IF NOT EXISTS user_events (
    id BIGSERIAL PRIMARY KEY,

    -- User identification
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Event core
    event_type VARCHAR(50) NOT NULL,  -- page_view, click, search, view_item, bookmark, like, review, chat_message, conversion
    event_name VARCHAR(100) NOT NULL, -- Specific event: click_my_task, view_place_da_nang, search_beach_resort

    -- Context
    page VARCHAR(255),                -- Current page URL/path
    object_type VARCHAR(50),          -- place, city, hotel, landmark
    object_id VARCHAR(100),           -- da_nang, place_123

    -- Behavior metrics
    duration_ms INTEGER,              -- Time spent (< 3s = lướt, 10-30s = quan tâm, > 60s = rất quan tâm)
    score INTEGER DEFAULT 0,          -- Interaction score: view=1, click=2, bookmark=4, like=5, review=8, conversion=10

    -- Extra data (flexible JSON for future extensions)
    payload JSONB,                    -- {"keyword": "resort biển", "filters": {}, "scroll_depth": 80, "referrer": "google"}

    -- Session tracking
    session_id UUID,

    -- Meta information (optional, filled by backend if available)
    ip_address INET,
    user_agent TEXT,

    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_event_type ON user_events(event_type);
CREATE INDEX IF NOT EXISTS idx_user_events_object ON user_events(object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_user_events_created_at ON user_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_payload ON user_events USING GIN(payload);

-- Enable Row Level Security
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only insert their own events
CREATE POLICY "Users can insert own events" ON user_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can read their own events
CREATE POLICY "Users can read own events" ON user_events
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Admins can read all events (for analytics)
CREATE POLICY "Admins can read all events" ON user_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );
