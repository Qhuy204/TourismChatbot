-- Migration: Create user_preferences table for UI customization and personalization
-- This table stores user theme preferences, travel style, and personalization settings

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- UI Theme settings
    theme VARCHAR(20) DEFAULT 'auto',  -- 'auto', 'calm', 'excited', 'curious', 'dark', 'light'
    animation_level VARCHAR(20) DEFAULT 'normal',  -- 'subtle', 'normal', 'vibrant'
    
    -- Travel preferences (for recommendations)
    preferred_cities TEXT[],
    travel_style VARCHAR(50),  -- 'adventure', 'relaxation', 'culture', 'nature', 'food'
    
    -- Detected emotion (updated by AI)
    last_detected_emotion VARCHAR(20) DEFAULT 'neutral',
    emotion_confidence REAL DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER trigger_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_user_preferences_updated_at();

-- RLS Policies
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
CREATE POLICY "Users can view own preferences" ON user_preferences
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own preferences
DROP POLICY IF EXISTS "Users can create own preferences" ON user_preferences;
CREATE POLICY "Users can create own preferences" ON user_preferences
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
CREATE POLICY "Users can update own preferences" ON user_preferences
    FOR UPDATE
    USING (auth.uid() = user_id);
