-- Migration: admin_audit_logs and user_bans

-- 1. admin_audit_logs table
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id UUID,
    justification TEXT,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    previous_hash TEXT,
    current_hash TEXT
);

-- Trigger function to compute hash on insert
CREATE OR REPLACE FUNCTION compute_audit_hash()
RETURNS TRIGGER AS $$
BEGIN
    NEW.current_hash := encode(digest(
        NEW.id::text || NEW.admin_id::text || NEW.action || extract(epoch from NEW.timestamp)::text || coalesce(NEW.previous_hash, ''), 
        'sha256'
    ), 'hex');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_hash_trigger
BEFORE INSERT ON public.admin_audit_logs
FOR EACH ROW EXECUTE FUNCTION compute_audit_hash();


-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.admin_audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.admin_audit_logs(action);

-- Enable RLS
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can select
CREATE POLICY "Admins can view audit logs" ON public.admin_audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
        )
    );

-- Admins can insert
CREATE POLICY "Admins can insert audit logs" ON public.admin_audit_logs
    FOR INSERT
    WITH CHECK (
        auth.uid() = admin_id AND
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
        )
    );

-- 2. user_bans table
CREATE TABLE IF NOT EXISTS public.user_bans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    banned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_user_bans_user_id ON public.user_bans(user_id);
-- Removed the NOW() constraint from index because postgres requires immutable functions in index clauses.
CREATE INDEX IF NOT EXISTS idx_user_bans_expires_at ON public.user_bans(expires_at);

-- RLS
ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

-- Admins can manage bans
CREATE POLICY "Admins can manage bans" ON public.user_bans
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
        )
    );

-- Users can read their own bans
CREATE POLICY "Users can view their own bans" ON public.user_bans
    FOR SELECT
    USING (auth.uid() = user_id);

-- 3. Modify chat_sessions for soft deletes
ALTER TABLE public.chat_sessions
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_deleted_at ON public.chat_sessions(deleted_at);

-- 4. user_quota_overrides table
CREATE TABLE IF NOT EXISTS public.user_quota_overrides (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    daily_requests INTEGER,
    daily_tokens INTEGER,
    daily_images INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.user_quota_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage overrides" ON public.user_quota_overrides
    FOR ALL USING (
        EXISTS ( SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin')
    );

-- 5. Supabase Cron logic for 90-day retention (requires pg_cron)
-- Only run if pg_cron is enabled. Wait, we can let Python handle this, or try:
-- select cron.schedule('cleanup-audit-logs', '0 2 * * *', $$
--    DELETE FROM public.admin_audit_logs WHERE timestamp < NOW() - INTERVAL '90 days';
-- $$);
