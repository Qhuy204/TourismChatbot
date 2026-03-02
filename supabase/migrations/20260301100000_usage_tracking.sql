-- Migration: Create usage_tracking table for quota management
-- Tracks daily API usage per user for rate limiting

CREATE TABLE IF NOT EXISTS usage_tracking (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    request_count INTEGER NOT NULL DEFAULT 0,
    token_count INTEGER NOT NULL DEFAULT 0,
    image_count INTEGER NOT NULL DEFAULT 0,
    last_request_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, date)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_usage_tracking_date ON usage_tracking(date DESC);

-- RLS
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage
DO $$
BEGIN
    CREATE POLICY "Users can view own usage" ON usage_tracking
        FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Service role handles inserts/updates from backend
DO $$
BEGIN
    CREATE POLICY "Service can manage usage" ON usage_tracking
        FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Function to increment usage atomically
CREATE OR REPLACE FUNCTION increment_usage(
    p_user_id UUID,
    p_requests INT DEFAULT 1,
    p_tokens INT DEFAULT 0,
    p_images INT DEFAULT 0
)
RETURNS TABLE(new_request_count INT, new_token_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO usage_tracking (user_id, date, request_count, token_count, image_count, last_request_at)
    VALUES (p_user_id, CURRENT_DATE, p_requests, p_tokens, p_images, NOW())
    ON CONFLICT (user_id, date) DO UPDATE SET
        request_count = usage_tracking.request_count + p_requests,
        token_count = usage_tracking.token_count + p_tokens,
        image_count = usage_tracking.image_count + p_images,
        last_request_at = NOW();

    RETURN QUERY SELECT
        usage_tracking.request_count,
        usage_tracking.token_count
    FROM usage_tracking
    WHERE usage_tracking.user_id = p_user_id AND usage_tracking.date = CURRENT_DATE;
END;
$$;

-- Quota limits table (configurable per role)
CREATE TABLE IF NOT EXISTS quota_limits (
    role TEXT PRIMARY KEY,
    daily_requests INTEGER NOT NULL DEFAULT 50,
    daily_tokens INTEGER NOT NULL DEFAULT 100000,
    daily_images INTEGER NOT NULL DEFAULT 10,
    max_history_days INTEGER NOT NULL DEFAULT 30
);

-- Insert default limits
INSERT INTO quota_limits (role, daily_requests, daily_tokens, daily_images, max_history_days)
VALUES
    ('user', 50, 100000, 10, 30),
    ('admin', 999999, 999999999, 9999, 365),
    ('api_client', 200, 500000, 50, 90)
ON CONFLICT (role) DO NOTHING;

-- RLS for quota_limits (read-only for all authenticated)
ALTER TABLE quota_limits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    CREATE POLICY "Anyone can read quota limits" ON quota_limits
        FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;
