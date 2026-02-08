-- Migration: Add user-specific recommendations
-- Updates get_recommendations() to include user's chat history

-- Drop and recreate with user-specific logic
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
    (
        -- Part 1: User's own popular questions (what they asked before)
        SELECT 
            cl.message,
            'history'::TEXT,
            'user_history'::TEXT,
            2.0::FLOAT  -- Higher score for user's own history
        FROM chat_logs cl
        WHERE cl.user_id = p_user_id
          AND cl.role = 'user'
          AND LENGTH(cl.message) > 15
        GROUP BY cl.message
        HAVING COUNT(*) >= 1
        ORDER BY MAX(cl.created_at) DESC
        LIMIT 2
    )
    UNION ALL
    (
        -- Part 2: Trending globally (popular questions from all users)
        SELECT 
            pq.sample_question,
            pq.categories[1],
            'trending'::TEXT,
            (pq.ask_count::FLOAT / 10)
        FROM popular_questions pq
        WHERE NOT EXISTS (
            -- Exclude questions user already asked
            SELECT 1 FROM chat_logs 
            WHERE user_id = p_user_id 
              AND role = 'user'
              AND LOWER(message) = pq.normalized_question
        )
        ORDER BY pq.ask_count DESC
        LIMIT 2
    )
    UNION ALL
    (
        -- Part 3: Topic-based from locations (based on user's cookie topics)
        SELECT 
            'Cho tôi biết về ' || lc.name,
            lc.category,
            'personalized'::TEXT,
            1.0::FLOAT
        FROM locations_cache lc
        WHERE p_topics IS NOT NULL 
          AND lc.category = ANY(p_topics)
        ORDER BY lc.extracted_at DESC
        LIMIT GREATEST(p_limit - 4, 1)
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_recommendations IS
'Get personalized question recommendations for a specific user.
Sources:
- user_history: Questions the user asked before
- trending: Popular questions from all users (excluding what user already asked)
- personalized: Based on user topic preferences from cookies';
