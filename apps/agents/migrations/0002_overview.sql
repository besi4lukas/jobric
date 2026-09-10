-- Migration 0002: Overview page support
-- Adds poll-freshness tracking to email_accounts and interview scheduling to
-- applications, plus an index for cross-application recent-activity reads.

ALTER TABLE email_accounts ADD COLUMN last_polled_at TEXT;
ALTER TABLE applications  ADD COLUMN interview_at   TEXT;

-- events is indexed (user_id, application_id, occurred_at DESC), which can't
-- serve "latest events across all of a user's applications".
CREATE INDEX idx_events_user_occurred ON events (user_id, occurred_at DESC);
