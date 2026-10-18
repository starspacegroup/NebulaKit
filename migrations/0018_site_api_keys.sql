-- The site API's keys (packages/security/src/api-keys.ts) and the per-key call log.
--
-- Only the SHA-256 of a key is stored; the plaintext is shown once at creation.
-- `scopes` is a space-separated list. Revoking sets `revoked_at` instead of
-- deleting the row, so the call log keeps naming the key that made each call.

CREATE TABLE IF NOT EXISTS api_keys (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	prefix TEXT NOT NULL,
	key_hash TEXT NOT NULL UNIQUE,
	scopes TEXT NOT NULL,
	created_by TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	expires_at TEXT,
	last_used_at TEXT,
	revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS api_key_calls (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	-- NULL for the orchestrator key, which lives in an environment secret, not here.
	key_id TEXT,
	method TEXT NOT NULL,
	path TEXT NOT NULL,
	status INTEGER NOT NULL,
	called_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_api_key_calls_key ON api_key_calls(key_id, called_at);

-- Which updates this site takes. Security updates are not in here on purpose:
-- they are forced, and there is no switch for them to read.
CREATE TABLE IF NOT EXISTS site_update_preferences (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	auto_apply_features INTEGER NOT NULL DEFAULT 0,
	-- JSON array of release ids the owner opted in to.
	opted_in TEXT NOT NULL DEFAULT '[]',
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
