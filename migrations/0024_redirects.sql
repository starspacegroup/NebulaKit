-- Redirect manager: admin-editable URL redirects with hit counting.
--
-- Consulted only when a request would otherwise be a 404 (src/hooks.server.ts
-- redirectsHandler), so healthy pages never pay for the lookup. to_path is a
-- same-site path or an https URL on an allowlist; the application validates
-- that on write and again on read (src/lib/server/redirects.ts). The CHECK
-- keeps status to the four redirect codes browsers treat as redirects.

CREATE TABLE IF NOT EXISTS redirects (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	from_path TEXT NOT NULL UNIQUE,
	to_path TEXT NOT NULL,
	status INTEGER NOT NULL DEFAULT 301 CHECK (status IN (301, 302, 307, 308)),
	hits INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
