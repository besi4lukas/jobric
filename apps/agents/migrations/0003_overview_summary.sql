-- Migration 0003: cached per-user Overview AI summary.
-- Derived cache, not a source of truth: safe to TRUNCATE; regenerates on the
-- next ingest that changes a status. Distinct from threads.summary
-- (per-thread, still unwritten — techdebt #7).
CREATE TABLE user_summaries (
  user_id       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  headline      TEXT,
  body          TEXT,
  model         TEXT,
  generated_at  TEXT,
  attempted_at  TEXT,
  failure_count INTEGER NOT NULL DEFAULT 0
);
