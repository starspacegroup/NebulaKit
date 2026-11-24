-- The public status page: component state, daily uptime counts, and incidents.
--
-- One row per component holds the CONFIRMED status plus the run of checks that
-- disagree with it. A change is shown only after two checks in a row agree, so
-- one failed probe never reaches the page (rules: src/lib/status/logic.ts).
--
-- Rollback: DROP TABLE status_incident_updates; DROP TABLE status_incidents;
--           DROP TABLE status_daily; DROP TABLE status_components;

CREATE TABLE IF NOT EXISTS status_components (
	id TEXT PRIMARY KEY,
	-- operational | degraded | down
	status TEXT NOT NULL DEFAULT 'operational',
	-- When the confirmed status began.
	since TEXT NOT NULL DEFAULT (datetime('now')),
	last_checked TEXT,
	latency_ms INTEGER,
	-- One plain sentence, public. Never an address or an error dump.
	detail TEXT,
	-- A different status seen on the most recent checks, not yet confirmed.
	pending_status TEXT,
	pending_count INTEGER NOT NULL DEFAULT 0,
	pending_since TEXT
);

-- Checks counted per component per UTC day, by the confirmed status at check time.
CREATE TABLE IF NOT EXISTS status_daily (
	component TEXT NOT NULL,
	-- YYYY-MM-DD, UTC.
	day TEXT NOT NULL,
	checks INTEGER NOT NULL DEFAULT 0,
	operational INTEGER NOT NULL DEFAULT 0,
	degraded INTEGER NOT NULL DEFAULT 0,
	down INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (component, day)
);

CREATE TABLE IF NOT EXISTS status_incidents (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	title TEXT NOT NULL,
	-- minor | major | critical | maintenance
	impact TEXT NOT NULL DEFAULT 'minor',
	-- investigating | identified | monitoring | resolved
	status TEXT NOT NULL DEFAULT 'investigating',
	-- JSON array of component ids.
	components TEXT NOT NULL DEFAULT '[]',
	-- 1 when the checks opened it; 0 when a person posted it.
	auto INTEGER NOT NULL DEFAULT 0,
	started_at TEXT NOT NULL DEFAULT (datetime('now')),
	resolved_at TEXT,
	created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_status_incidents_open ON status_incidents(resolved_at);
CREATE INDEX IF NOT EXISTS idx_status_incidents_started ON status_incidents(started_at);

CREATE TABLE IF NOT EXISTS status_incident_updates (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	incident_id INTEGER NOT NULL REFERENCES status_incidents(id) ON DELETE CASCADE,
	status TEXT NOT NULL,
	body TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_status_incident_updates_incident
	ON status_incident_updates(incident_id, id);
