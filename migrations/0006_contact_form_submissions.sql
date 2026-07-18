-- Contact form submissions: public contact form + admin review inbox.
-- Ported from AgapeVerse (combined its 0004 base table + 0013 is_resolved
-- backfill into one clean table). Rows are created by the public contact
-- endpoint/action; admins move them one-way from open (0) -> resolved (1).
CREATE TABLE IF NOT EXISTS contact_form_submissions (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  is_resolved INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contact_form_submissions_created ON contact_form_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_form_submissions_resolved ON contact_form_submissions(is_resolved);
