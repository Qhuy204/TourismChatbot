-- Migration: Create locations_cache table for offline access
-- Stores extracted locations from chatbot responses

CREATE TABLE IF NOT EXISTS locations_cache (
    id BIGSERIAL PRIMARY KEY,
    
    -- Location identity
    name TEXT NOT NULL,
    name_normalized TEXT NOT NULL,  -- lowercase for dedup
    
    -- Geographic info
    city TEXT,
    province TEXT,
    
    -- Classification
    category TEXT DEFAULT 'other',  -- beach|heritage|nature|food|temple|city
    
    -- Content
    description TEXT,
    details JSONB,  -- Extended info if available
    
    -- Source tracking
    source_response_id BIGINT REFERENCES chat_logs(id) ON DELETE SET NULL,
    extracted_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Search optimization
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('simple', coalesce(name, '') || ' ' || 
                    coalesce(city, '') || ' ' || 
                    coalesce(province, ''))
    ) STORED,
    
    -- Unique constraint on normalized name
    CONSTRAINT unique_location_name UNIQUE (name_normalized)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_locations_category ON locations_cache(category);
CREATE INDEX IF NOT EXISTS idx_locations_city ON locations_cache(city);
CREATE INDEX IF NOT EXISTS idx_locations_search ON locations_cache USING GIN(search_vector);

-- RLS - locations are public readable
ALTER TABLE locations_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Locations are publicly readable"
    ON locations_cache FOR SELECT USING (true);

CREATE POLICY "Service role can insert locations"
    ON locations_cache FOR INSERT
    WITH CHECK (true);
