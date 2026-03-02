-- Migration: Add request_id to admin_audit_logs
ALTER TABLE public.admin_audit_logs 
ADD COLUMN IF NOT EXISTS request_id UUID;

CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON public.admin_audit_logs(request_id);
