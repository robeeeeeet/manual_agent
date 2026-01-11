-- Add is_archived column to maintenance_schedules table
-- This allows users to archive maintenance items without deleting them

ALTER TABLE maintenance_schedules
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- Create partial index for efficient filtering of non-archived items
-- This index only includes rows where is_archived = false (the common case)
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_is_archived
ON maintenance_schedules (is_archived)
WHERE is_archived = false;

-- Add comment for documentation
COMMENT ON COLUMN maintenance_schedules.is_archived IS 'Whether this schedule is archived. Archived items are hidden from default lists but can be restored.';
