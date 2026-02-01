-- Add soft delete and tracking columns to dataset_records
ALTER TABLE public.dataset_records 
ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS deleted_by uuid,
ADD COLUMN IF NOT EXISTS updated_by uuid,
ADD COLUMN IF NOT EXISTS edit_count integer NOT NULL DEFAULT 0;

-- Create index for faster queries on is_deleted
CREATE INDEX IF NOT EXISTS idx_dataset_records_is_deleted ON public.dataset_records(is_deleted);

-- Create index for sorting by updated_at
CREATE INDEX IF NOT EXISTS idx_dataset_records_updated_at ON public.dataset_records(updated_at DESC);

-- Create a table for system usage tracking (API calls, storage)
CREATE TABLE IF NOT EXISTS public.system_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usage_type text NOT NULL, -- 'api_calls', 'storage_mb', 'records_count'
  current_value numeric NOT NULL DEFAULT 0,
  max_limit numeric NOT NULL DEFAULT 0,
  warning_threshold numeric NOT NULL DEFAULT 80, -- percentage
  last_checked_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on system_usage
ALTER TABLE public.system_usage ENABLE ROW LEVEL SECURITY;

-- Only admins can manage system_usage
CREATE POLICY "Admins can manage system_usage" 
ON public.system_usage 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default usage tracking records
INSERT INTO public.system_usage (usage_type, current_value, max_limit, warning_threshold)
VALUES 
  ('api_calls_daily', 0, 10000, 80),
  ('storage_mb', 0, 500, 80),
  ('records_count', 0, 100000, 90)
ON CONFLICT DO NOTHING;

-- Create trigger to increment edit_count on update
CREATE OR REPLACE FUNCTION public.increment_edit_count()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.data IS DISTINCT FROM NEW.data OR OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.edit_count = COALESCE(OLD.edit_count, 0) + 1;
    NEW.updated_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger for edit count
DROP TRIGGER IF EXISTS trigger_increment_edit_count ON public.dataset_records;
CREATE TRIGGER trigger_increment_edit_count
  BEFORE UPDATE ON public.dataset_records
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_edit_count();

-- Create trigger for updated_at on system_usage
CREATE TRIGGER update_system_usage_updated_at
  BEFORE UPDATE ON public.system_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();