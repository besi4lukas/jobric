-- Migration 0005: Applications tab support.
-- status_source records who last set applications.status. 'gmail' = the
-- ingestion pipeline (StatusTracker); 'user' = a manual edit from the
-- dashboard. The orchestrator never overwrites a 'user' status (see
-- db/applications.ts) — without this a single ingested email would undo
-- the edit. NOT NULL DEFAULT is required for ALTER TABLE; every existing
-- row is pipeline-written, so 'gmail' is the correct backfill.
ALTER TABLE applications
  ADD COLUMN status_source TEXT NOT NULL DEFAULT 'gmail'
  CHECK (status_source IN ('gmail', 'user'));

-- Keyset pagination for GET /api/applications:
--   WHERE user_id = ? AND (last_activity_at, id) < (?, ?)
--   ORDER BY last_activity_at DESC, id DESC
-- Replaces the 0001 index, which is a strict prefix of this one.
DROP INDEX idx_applications_user_activity;
CREATE INDEX idx_applications_user_activity
  ON applications (user_id, last_activity_at DESC, id DESC);
