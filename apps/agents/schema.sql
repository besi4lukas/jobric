CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  confidence TEXT NOT NULL,
  next_steps TEXT,
  interview_date TEXT,
  status_changed INTEGER DEFAULT 0,
  processed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_user_company_role ON applications(user_id, company, role);

CREATE TABLE IF NOT EXISTS status_history (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id),
  user_id TEXT NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  changed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_status_history_user_id ON status_history(user_id);
CREATE INDEX IF NOT EXISTS idx_status_history_application_id ON status_history(application_id);
