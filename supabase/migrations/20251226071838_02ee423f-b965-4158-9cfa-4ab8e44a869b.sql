-- Drop old restrictive policies
DROP POLICY IF EXISTS "Users can view their assigned tasks" ON annotation_tasks;
DROP POLICY IF EXISTS "Users can view their task_records" ON task_records;
DROP POLICY IF EXISTS "Users can view assigned records" ON dataset_records;

-- Recreate as PERMISSIVE (default) policies
CREATE POLICY "Users can view their assigned tasks"
ON annotation_tasks
FOR SELECT
TO authenticated
USING (assigned_to = auth.uid());

CREATE POLICY "Users can view their task_records"
ON task_records
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM annotation_tasks at
    WHERE at.id = task_records.task_id AND at.assigned_to = auth.uid()
  )
);

CREATE POLICY "Users can view assigned records"
ON dataset_records
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM task_records tr
    JOIN annotation_tasks at ON tr.task_id = at.id
    WHERE tr.record_id = dataset_records.id AND at.assigned_to = auth.uid()
  )
);