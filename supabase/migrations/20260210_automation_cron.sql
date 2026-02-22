--   1. Enable pg_cron extension
--   2. Schedule nightly cleanup for locations (deduplication)
--   3. Schedule nightly refresh for popular questions analytics

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule Periodic Cleanup (Every 2 Hours)
-- threshold 0.85, dry_run = false (actually perform cleanup)
SELECT cron.schedule(
  'periodic-location-dedup',
  '0 */2 * * *',
  $$SELECT cleanup_duplicate_locations(0.85, false)$$
);

-- Schedule Nightly Refresh Analytics (3:00 AM)
SELECT cron.schedule(
  'nightly-popular-questions-refresh',
  '0 3 * * *',
  $$SELECT refresh_popular_questions()$$
);

-- Check status:
-- SELECT * FROM cron.job;
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

COMMENT ON EXTENSION pg_cron IS 'Scheduled jobs for database maintenance';
