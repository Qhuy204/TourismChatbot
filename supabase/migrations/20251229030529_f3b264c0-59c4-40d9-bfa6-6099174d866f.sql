-- Add import_version column to track data by import batch
ALTER TABLE public.dataset_records
ADD COLUMN import_version integer DEFAULT 1;

-- Add import_batch_id to identify specific import sessions
ALTER TABLE public.dataset_records
ADD COLUMN import_batch_id uuid;

-- Add imported_at timestamp
ALTER TABLE public.dataset_records
ADD COLUMN imported_at timestamp with time zone DEFAULT now();

-- Create index for efficient filtering by version
CREATE INDEX idx_dataset_records_import_version ON public.dataset_records(import_version);
CREATE INDEX idx_dataset_records_import_batch_id ON public.dataset_records(import_batch_id);