-- Migration 0001: v1 schema
-- D1 (SQLite). Timestamps stored as ISO-8601 TEXT. IDs stored as UUID TEXT.

-- ─── users ───────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- ─── email_accounts ──────────────────────────────────────────────────────────
CREATE TABLE email_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  encrypted_refresh_token TEXT NOT NULL,
  last_history_id TEXT,
  watch_expires_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (email)
);

CREATE INDEX idx_email_accounts_user
  ON email_accounts (user_id);

-- ─── companies ───────────────────────────────────────────────────────────────
CREATE TABLE companies (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  domain TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_companies_user
  ON companies (user_id);

-- ─── applications ────────────────────────────────────────────────────────────
CREATE TABLE applications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  role_title TEXT NOT NULL,
  requisition_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('applied','replied','interviewing','offer','closed')),
  funnel_rank INTEGER NOT NULL CHECK (funnel_rank IN (0,1,2,3,4)),
  first_contact_at TEXT NOT NULL,
  last_activity_at TEXT NOT NULL,
  CHECK (
    (status = 'applied'      AND funnel_rank = 1) OR
    (status = 'replied'      AND funnel_rank = 2) OR
    (status = 'interviewing' AND funnel_rank = 3) OR
    (status = 'offer'        AND funnel_rank = 4) OR
    (status = 'closed'       AND funnel_rank = 0)
  )
);

CREATE INDEX idx_applications_user_activity
  ON applications (user_id, last_activity_at DESC);

-- Dedup on (user, company, role, requisition). Two reqs with the same title
-- coexist when both have req ids; null-req rows dedupe by title alone.
CREATE UNIQUE INDEX uq_applications_user_company_role_req
  ON applications (user_id, company_id, role_title, COALESCE(requisition_id, ''));

-- ─── threads ─────────────────────────────────────────────────────────────────
CREATE TABLE threads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  gmail_thread_id TEXT NOT NULL,
  summary TEXT,
  summary_updated_at TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, gmail_thread_id)
);

CREATE INDEX idx_threads_user_application
  ON threads (user_id, application_id);

-- ─── messages ────────────────────────────────────────────────────────────────
-- No raw_body: snippet only. Re-fetch full body from Gmail on demand.
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  gmail_message_id TEXT NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT,
  snippet TEXT,
  sent_at TEXT NOT NULL,
  processed_at TEXT,
  UNIQUE (user_id, gmail_message_id)
);

CREATE INDEX idx_messages_user_thread_sent
  ON messages (user_id, thread_id, sent_at);

-- ─── events ──────────────────────────────────────────────────────────────────
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('applied','replied','interview','offer','closed')),
  occurred_at TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('gmail','system','user')),
  metadata TEXT,
  message_id TEXT REFERENCES messages(id) ON DELETE SET NULL
);

CREATE INDEX idx_events_user_application_occurred
  ON events (user_id, application_id, occurred_at DESC);

-- ─── parse_failures ──────────────────────────────────────────────────────────
CREATE TABLE parse_failures (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gmail_message_id TEXT NOT NULL,
  error TEXT NOT NULL,
  attempted_at TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE INDEX idx_parse_failures_user_attempted
  ON parse_failures (user_id, attempted_at DESC);
