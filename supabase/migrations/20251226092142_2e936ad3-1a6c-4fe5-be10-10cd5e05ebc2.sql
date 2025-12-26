-- Drop old constraint if exists (from old table name)
ALTER TABLE anno_task_details DROP CONSTRAINT IF EXISTS task_records_task_id_record_id_key;

-- Add new unique constraint with proper name
ALTER TABLE anno_task_details DROP CONSTRAINT IF EXISTS anno_task_details_task_id_image_id_key;
ALTER TABLE anno_task_details ADD CONSTRAINT anno_task_details_task_id_image_id_key UNIQUE (task_id, image_id);