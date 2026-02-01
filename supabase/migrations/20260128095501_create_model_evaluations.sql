-- Migration: Create model_evaluations table for quality metrics
-- Tracks response latency, relevance, and hallucination scores

CREATE TABLE IF NOT EXISTS model_evaluations (
    id BIGSERIAL PRIMARY KEY,
    
    -- Reference to chat
    chat_log_id BIGINT REFERENCES chat_logs(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    
    -- Automatic metrics
    response_latency_ms INTEGER,    -- Time to generate response
    context_relevance REAL,         -- 0-1 score from retriever
    context_count INTEGER,          -- Number of RAG sources used
    model_used TEXT,                -- Which Gemini model
    
    -- Quality metrics
    hallucination_score REAL,       -- 0-1, lower is better
    response_length INTEGER,        -- Character count
    
    -- User feedback (updated later)
    user_feedback_score INTEGER,    -- -1, 0, 1
    
    -- Timestamps
    evaluated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_evaluations_session ON model_evaluations(session_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_chat ON model_evaluations(chat_log_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_feedback ON model_evaluations(user_feedback_score) 
    WHERE user_feedback_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_evaluations_date ON model_evaluations(evaluated_at DESC);

-- Aggregated metrics view
CREATE OR REPLACE VIEW v_model_metrics AS
SELECT 
    model_used,
    DATE(evaluated_at) as date,
    COUNT(*) as total_responses,
    AVG(response_latency_ms)::INTEGER as avg_latency_ms,
    AVG(context_relevance) as avg_relevance,
    AVG(CASE WHEN user_feedback_score = 1 THEN 1.0 
             WHEN user_feedback_score = -1 THEN 0.0 
             ELSE 0.5 END) as satisfaction_rate,
    AVG(hallucination_score) as avg_hallucination,
    AVG(context_count) as avg_context_count
FROM model_evaluations
WHERE model_used IS NOT NULL
GROUP BY model_used, DATE(evaluated_at)
ORDER BY date DESC, model_used;

-- RLS
ALTER TABLE model_evaluations ENABLE ROW LEVEL SECURITY;

-- Service role can insert/update
CREATE POLICY "Service role manages evaluations"
    ON model_evaluations FOR ALL
    WITH CHECK (true);

-- Admins can read all
CREATE POLICY "Admins can read evaluations"
    ON model_evaluations FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );
