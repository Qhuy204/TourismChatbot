-- Migration: Location Deduplication & Smart Insert
-- Features:
--   1. check_location_duplicate() - Check similarity before insert
--   2. insert_location_smart() - Smart insert with dedup handling
--   3. find_duplicate_locations() - Scan existing data for duplicates
--   4. cleanup_duplicate_locations() - Delete/Merge based on 85% threshold

-- ============================================
-- SETUP: Enable pg_trgm extension
-- ============================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Index for fast similarity search on locations_cache
CREATE INDEX IF NOT EXISTS idx_locations_name_trgm 
ON locations_cache USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_locations_name_normalized_trgm 
ON locations_cache USING GIN (name_normalized gin_trgm_ops);

-- ============================================
-- FEATURE 1: Duplicate Check on Insert
-- ============================================

-- Check if a location name is duplicate
CREATE OR REPLACE FUNCTION check_location_duplicate(
    p_name TEXT,
    p_threshold FLOAT DEFAULT 0.85
)
RETURNS TABLE(
    existing_id BIGINT,
    existing_name TEXT,
    similarity_score FLOAT,
    recommended_action TEXT  -- 'skip' | 'merge' | 'allow'
) AS $$
DECLARE
    v_normalized TEXT := LOWER(TRIM(p_name));
BEGIN
    RETURN QUERY
    SELECT 
        lc.id,
        lc.name,
        similarity(lc.name_normalized, v_normalized)::FLOAT as sim,
        CASE 
            -- Exact or very high match (>=85%) -> skip insert
            WHEN similarity(lc.name_normalized, v_normalized) >= p_threshold THEN 'skip'
            -- Medium match (60-85%) -> merge with existing
            WHEN similarity(lc.name_normalized, v_normalized) >= 0.6 THEN 'merge'
            -- No significant match -> allow new insert
            ELSE 'allow'
        END as action
    FROM locations_cache lc
    WHERE similarity(lc.name_normalized, v_normalized) >= 0.6
    ORDER BY sim DESC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_location_duplicate IS 
'Check if a location name has duplicates. Returns matches with similarity >= 60%.
Actions: skip (>=85%), merge (60-85%), allow (<60%)';

-- ============================================
-- FEATURE 1B: Smart Insert with Dedup
-- ============================================

CREATE OR REPLACE FUNCTION insert_location_smart(
    p_name TEXT,
    p_city TEXT DEFAULT NULL,
    p_province TEXT DEFAULT NULL,
    p_category TEXT DEFAULT 'other',
    p_description TEXT DEFAULT NULL,
    p_details JSONB DEFAULT NULL,
    p_source_id BIGINT DEFAULT NULL
)
RETURNS TABLE(
    result_id BIGINT,
    result_action TEXT,  -- 'inserted' | 'skipped' | 'merged'
    matched_with TEXT
) AS $$
DECLARE
    v_normalized TEXT := LOWER(TRIM(p_name));
    v_existing RECORD;
    v_new_id BIGINT;
BEGIN
    -- Check for duplicates first
    SELECT * INTO v_existing 
    FROM check_location_duplicate(p_name, 0.85) 
    LIMIT 1;
    
    -- Case 1: No significant match found -> INSERT new
    IF v_existing IS NULL OR v_existing.recommended_action = 'allow' THEN
        INSERT INTO locations_cache (
            name, name_normalized, city, province, 
            category, description, details, source_response_id
        )
        VALUES (
            p_name, v_normalized, p_city, p_province,
            p_category, p_description, p_details, p_source_id
        )
        RETURNING id INTO v_new_id;
        
        RETURN QUERY SELECT v_new_id, 'inserted'::TEXT, NULL::TEXT;
        
    -- Case 2: High similarity (>=85%) -> SKIP (don't insert)
    ELSIF v_existing.recommended_action = 'skip' THEN
        RETURN QUERY SELECT v_existing.existing_id, 'skipped'::TEXT, v_existing.existing_name;
        
    -- Case 3: Medium similarity (60-85%) -> MERGE into existing
    ELSE
        UPDATE locations_cache SET
            -- Append description (if new info available)
            description = CASE 
                WHEN p_description IS NOT NULL AND p_description != '' THEN
                    COALESCE(description, '') || E'\n---\n' || p_description
                ELSE description
            END,
            -- Merge JSON details
            details = COALESCE(details, '{}'::jsonb) || COALESCE(p_details, '{}'::jsonb),
            -- Fill missing city/province
            city = COALESCE(city, p_city),
            province = COALESCE(province, p_province)
        WHERE id = v_existing.existing_id;
        
        RETURN QUERY SELECT v_existing.existing_id, 'merged'::TEXT, v_existing.existing_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION insert_location_smart IS
'Smart insert that handles duplicates:
- >=85% similarity: Skip insert, return existing
- 60-85% similarity: Merge description/details into existing
- <60% similarity: Insert as new record';

-- ============================================
-- FEATURE 2: Scanner - Find Duplicates in Old Data
-- ============================================

CREATE OR REPLACE FUNCTION find_duplicate_locations(
    p_min_similarity FLOAT DEFAULT 0.6
)
RETURNS TABLE(
    loc1_id BIGINT,
    loc1_name TEXT,
    loc2_id BIGINT,
    loc2_name TEXT,
    similarity_score FLOAT,
    recommended_action TEXT  -- 'delete_loc2' | 'merge_into_loc1'
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l1.id,
        l1.name,
        l2.id,
        l2.name,
        similarity(l1.name_normalized, l2.name_normalized)::FLOAT as sim,
        CASE 
            WHEN similarity(l1.name_normalized, l2.name_normalized) >= 0.85 THEN 'delete_loc2'
            ELSE 'merge_into_loc1'
        END as action
    FROM locations_cache l1
    JOIN locations_cache l2 ON l1.id < l2.id  -- Avoid self-compare and duplicates
    WHERE similarity(l1.name_normalized, l2.name_normalized) >= p_min_similarity
    ORDER BY sim DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION find_duplicate_locations IS
'Scan all locations_cache for duplicate pairs.
Returns pairs with similarity >= 60%, ordered by similarity.
Actions: >=85% delete_loc2, 60-85% merge_into_loc1';

-- ============================================
-- FEATURE 2B: Cleanup Duplicates (Delete/Merge)
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_duplicate_locations(
    p_threshold FLOAT DEFAULT 0.85,
    p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(
    action_taken TEXT,
    affected_id BIGINT,
    kept_id BIGINT,
    affected_name TEXT,
    kept_name TEXT,
    similarity_score FLOAT
) AS $$
DECLARE
    dup RECORD;
    v_deleted INT := 0;
    v_merged INT := 0;
BEGIN
    FOR dup IN 
        SELECT * FROM find_duplicate_locations(0.6) 
        ORDER BY similarity_score DESC
    LOOP
        -- Skip if loc2 was already deleted in a previous iteration
        IF NOT EXISTS (SELECT 1 FROM locations_cache WHERE id = dup.loc2_id) THEN
            CONTINUE;
        END IF;
        
        IF dup.similarity_score >= p_threshold THEN
            -- HIGH SIMILARITY (>=85%): DELETE the duplicate
            IF NOT p_dry_run THEN
                DELETE FROM locations_cache WHERE id = dup.loc2_id;
            END IF;
            v_deleted := v_deleted + 1;
            
            RETURN QUERY SELECT 
                'deleted'::TEXT, 
                dup.loc2_id, 
                dup.loc1_id,
                dup.loc2_name,
                dup.loc1_name,
                dup.similarity_score;
        ELSE
            -- MEDIUM SIMILARITY (60-85%): MERGE then delete
            IF NOT p_dry_run THEN
                -- Merge loc2 info into loc1
                UPDATE locations_cache SET
                    description = COALESCE(description, '') || E'\n---\n' || 
                        COALESCE((SELECT description FROM locations_cache WHERE id = dup.loc2_id), ''),
                    details = COALESCE(details, '{}'::jsonb) || 
                        COALESCE((SELECT details FROM locations_cache WHERE id = dup.loc2_id), '{}'::jsonb)
                WHERE id = dup.loc1_id;
                
                -- Delete the merged record
                DELETE FROM locations_cache WHERE id = dup.loc2_id;
            END IF;
            v_merged := v_merged + 1;
            
            RETURN QUERY SELECT 
                'merged'::TEXT, 
                dup.loc2_id, 
                dup.loc1_id,
                dup.loc2_name,
                dup.loc1_name,
                dup.similarity_score;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Cleanup complete: % deleted (>=85%%), % merged (60-85%%). dry_run=%', 
        v_deleted, v_merged, p_dry_run;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_duplicate_locations IS
'Cleanup duplicate locations:
- dry_run=TRUE: Only report what would be done
- dry_run=FALSE: Actually delete/merge records
- >=85% similarity: Delete duplicate (keep older)
- 60-85% similarity: Merge descriptions then delete';

-- ============================================
-- FEATURE 3: Popular Questions View
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS popular_questions AS
SELECT 
    LOWER(TRIM(REGEXP_REPLACE(message, '[?!.,]', '', 'g'))) as normalized_question,
    MIN(message) as sample_question,
    COUNT(*) as ask_count,
    ARRAY_AGG(DISTINCT 
        CASE 
            WHEN message ~* 'biển|beach|đảo|island' THEN 'beach'
            WHEN message ~* 'núi|mountain|đèo|highland' THEN 'mountain'
            WHEN message ~* 'ẩm thực|food|quán|ăn|restaurant' THEN 'food'
            WHEN message ~* 'lịch trình|tour|ngày|itinerary' THEN 'itinerary'
            WHEN message ~* 'khách sạn|hotel|resort|homestay' THEN 'accommodation'
            ELSE 'general'
        END
    ) as categories,
    MAX(created_at) as last_asked_at
FROM chat_logs
WHERE role = 'user'
  AND LENGTH(message) > 10
GROUP BY normalized_question
HAVING COUNT(*) >= 2
ORDER BY ask_count DESC
LIMIT 100;

CREATE UNIQUE INDEX IF NOT EXISTS idx_popular_questions_norm 
ON popular_questions(normalized_question);

-- ============================================
-- FEATURE 3B: Get Recommendations
-- ============================================

CREATE OR REPLACE FUNCTION get_recommendations(
    p_user_id UUID,
    p_topics TEXT[] DEFAULT NULL,
    p_limit INT DEFAULT 5
)
RETURNS TABLE(
    question TEXT,
    category TEXT,
    source TEXT,
    score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    -- Use subqueries wrapped in parentheses for UNION with LIMIT
    (
        -- Part 1: Trending (top asked globally)
        SELECT 
            pq.sample_question,
            pq.categories[1],
            'trending'::TEXT,
            (pq.ask_count::FLOAT / 10)
        FROM popular_questions pq
        ORDER BY pq.ask_count DESC
        LIMIT 2
    )
    UNION ALL
    (
        -- Part 2: Topic-based (from user's cookies)
        SELECT 
            'Cho tôi biết về ' || lc.name,
            lc.category,
            'personalized'::TEXT,
            1.0::FLOAT
        FROM locations_cache lc
        WHERE p_topics IS NOT NULL 
          AND lc.category = ANY(p_topics)
        ORDER BY lc.extracted_at DESC
        LIMIT GREATEST(p_limit - 2, 1)
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_recommendations IS
'Get personalized question recommendations.
Combines trending questions and topic-based suggestions from locations.';

-- ============================================
-- UTILITY: Refresh Popular Questions
-- ============================================

CREATE OR REPLACE FUNCTION refresh_popular_questions()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY popular_questions;
END;
$$ LANGUAGE plpgsql;
