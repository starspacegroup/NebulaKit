-- Admin audit log and opt-in sign-in tracking.
--
-- 1. admin_actions: who changed what from the admin area or the site API.
--    Mutations only, never page views. The actor and target are stored as
--    plain snapshots (id + login), deliberately NOT foreign keys: the log has
--    to outlive the user it describes, including a user who was deleted or
--    merged away. `detail_json` is scrubbed of secrets and size-bounded by
--    src/lib/server/audit.ts before it is written. Rows older than 365 days
--    are pruned by POST /api/cron/prune-audit.
CREATE TABLE IF NOT EXISTS admin_actions (
	id TEXT PRIMARY KEY,
	actor_id TEXT,
	actor_login TEXT NOT NULL,
	action TEXT NOT NULL,
	target_type TEXT,
	target_id TEXT,
	summary TEXT NOT NULL,
	detail_json TEXT,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON admin_actions (created_at);
CREATE INDEX IF NOT EXISTS idx_admin_actions_actor ON admin_actions (actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_admin_actions_action ON admin_actions (action, created_at);

-- 2. Sign-in tracking. OFF BY DEFAULT: nothing below is written until the owner
--    turns "Sign-in tracking" on at /admin/sign-ins (the switch lives in KV, key
--    `sign_in_tracking`). When it is on, one row per attempt, failures included.
--    The raw user agent is never stored, only a coarse "Chrome on macOS" bucket;
--    the IP is stored in full for incident response and masked when shown.
--    Rows older than 90 days are pruned as new ones are written. user_id is not
--    a foreign key, so history survives deleting the account.
CREATE TABLE IF NOT EXISTS sign_in_events (
	id TEXT PRIMARY KEY,
	user_id TEXT,
	method TEXT NOT NULL,
	success INTEGER NOT NULL CHECK (success IN (0, 1)),
	reason TEXT,
	ip TEXT,
	device TEXT,
	country TEXT,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_sign_in_events_created_at ON sign_in_events (created_at);
CREATE INDEX IF NOT EXISTS idx_sign_in_events_user ON sign_in_events (user_id, created_at);

-- Written (at most every five minutes) only while tracking is on; NULL otherwise.
ALTER TABLE sessions ADD COLUMN last_seen_at TEXT;
