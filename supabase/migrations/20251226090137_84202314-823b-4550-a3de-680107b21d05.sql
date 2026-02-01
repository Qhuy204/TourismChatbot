-- STEP 1: Fix annotation_tasks table first
-- Drop check constraint
ALTER TABLE public.annotation_tasks DROP CONSTRAINT IF EXISTS annotation_tasks_status_check;

-- Update status values before adding constraint
UPDATE public.annotation_tasks SET status = 'open' WHERE status = 'pending';
UPDATE public.annotation_tasks SET status = 'done' WHERE status = 'completed';

-- Add new check constraint
ALTER TABLE public.annotation_tasks ADD CONSTRAINT annotation_tasks_status_check 
CHECK (status IN ('open', 'in_progress', 'done', 'archived'));

-- Rename id to task_id
ALTER TABLE public.annotation_tasks RENAME COLUMN id TO task_id;
ALTER TABLE public.annotation_tasks RENAME COLUMN name TO task_name;

-- Drop unnecessary columns
ALTER TABLE public.annotation_tasks DROP COLUMN IF EXISTS percentage;
ALTER TABLE public.annotation_tasks DROP COLUMN IF EXISTS description;

-- STEP 2: Drop existing policies on task_records
DROP POLICY IF EXISTS "Admins can manage all task_records" ON public.task_records;
DROP POLICY IF EXISTS "Users can update their task_records" ON public.task_records;
DROP POLICY IF EXISTS "Users can view their task_records" ON public.task_records;

-- STEP 3: Rename task_records to anno_task_details
ALTER TABLE public.task_records RENAME TO anno_task_details;

-- STEP 4: Rename columns
ALTER TABLE public.anno_task_details RENAME COLUMN record_id TO image_id;
ALTER TABLE public.anno_task_details RENAME COLUMN annotated_by TO annotator_id;
ALTER TABLE public.anno_task_details RENAME COLUMN annotated_at TO updated_at;

-- STEP 5: Add new columns
ALTER TABLE public.anno_task_details ADD COLUMN IF NOT EXISTS reviewed_by uuid;
ALTER TABLE public.anno_task_details ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone;

-- STEP 6: Update status values
ALTER TABLE public.anno_task_details DROP CONSTRAINT IF EXISTS task_records_status_check;
UPDATE public.anno_task_details SET status = 'approved' WHERE status = 'completed';
ALTER TABLE public.anno_task_details ADD CONSTRAINT anno_task_details_status_check
CHECK (status IN ('pending', 'approved', 'rejected', 'needs_review'));

-- STEP 7: Enable RLS and create policies
ALTER TABLE public.anno_task_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all anno_task_details"
ON public.anno_task_details
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their anno_task_details"
ON public.anno_task_details
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM annotation_tasks at
  WHERE at.task_id = anno_task_details.task_id 
  AND at.assigned_to = auth.uid()
));

CREATE POLICY "Users can update their anno_task_details"
ON public.anno_task_details
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM annotation_tasks at
  WHERE at.task_id = anno_task_details.task_id 
  AND at.assigned_to = auth.uid()
));

-- STEP 8: Update foreign key constraints
ALTER TABLE public.anno_task_details DROP CONSTRAINT IF EXISTS task_records_task_id_fkey;
ALTER TABLE public.anno_task_details 
ADD CONSTRAINT anno_task_details_task_id_fkey 
FOREIGN KEY (task_id) REFERENCES public.annotation_tasks(task_id) ON DELETE CASCADE;

ALTER TABLE public.anno_task_details DROP CONSTRAINT IF EXISTS task_records_record_id_fkey;
ALTER TABLE public.anno_task_details 
ADD CONSTRAINT anno_task_details_image_id_fkey 
FOREIGN KEY (image_id) REFERENCES public.dataset_records(id) ON DELETE CASCADE;

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_anno_task_details_updated_at ON public.anno_task_details;
CREATE TRIGGER update_anno_task_details_updated_at
BEFORE UPDATE ON public.anno_task_details
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();