-- Migration 0004: AI Inbox ingestion support.
-- threads/messages were defined in 0001 but never written (techdebt #7).
-- The orchestrator now populates both; this adds the sort key the Inbox
-- read path pages on. Nullable because ALTER TABLE can't add a NOT NULL
-- column without a default — every write path sets it, and the (future)
-- inbox route filters IS NOT NULL. Derived from messages.sent_at:
-- recomputed on every write, never incremented, so cron replays can't drift it.
ALTER TABLE threads ADD COLUMN last_message_at TEXT;

-- Keyset pagination: WHERE user_id = ? AND (last_message_at, id) < (?, ?)
-- ORDER BY last_message_at DESC, id DESC — served entirely by this index.
CREATE INDEX idx_threads_user_last_message
  ON threads (user_id, last_message_at DESC, id DESC);
