-- Lighthouse scores for this app's own public pages, refreshed on a schedule.
--
-- The scores come from Google's PageSpeed Insights API, which runs Lighthouse
-- on Google's infrastructure and returns the report over plain HTTP. That is
-- what makes this possible at all: Lighthouse needs Chrome, a Cloudflare
-- Worker has no browser, and this project deploys to Pages, which has no Cron
-- Triggers either. PSI needs neither — see src/lib/server/lighthouse.ts.
--
-- Two tables, and the split is deliberate. The scores answer "is anything
-- wrong", and the findings answer "what". Keeping the findings separate means
-- the summary query the admin page opens with never drags a few hundred audit
-- descriptions across the wire.
--
-- LATEST ONLY, not history. Both tables are keyed on (path, strategy) and each
-- run replaces its own rows, so the table size is bounded by the number of
-- public pages times two form factors, forever. That is a deliberate trade:
-- there is no trend chart, and in exchange there is no retention cron to
-- forget and no table that grows with time. History can be added later by
-- dropping the unique constraint and stamping a run id.

CREATE TABLE IF NOT EXISTS lighthouse_audits (
	path TEXT NOT NULL,
	-- 'mobile' or 'desktop'. PSI scores the two very differently and a mobile
	-- score is the one Google ranks on, so which was measured is part of the key
	-- rather than a detail in a comment.
	strategy TEXT NOT NULL,
	fetched_at TEXT NOT NULL,
	-- 0-100, already rounded from PSI's 0-1. NULL when the run failed, which is
	-- why these are nullable and `error` exists: a page PSI could not reach is a
	-- thing the admin page has to be able to show, and it is not a zero.
	performance INTEGER,
	accessibility INTEGER,
	best_practices INTEGER,
	seo INTEGER,
	lighthouse_version TEXT,
	-- Populated only when the run failed; the message PSI gave, or ours.
	error TEXT,
	PRIMARY KEY (path, strategy)
);

CREATE TABLE IF NOT EXISTS lighthouse_findings (
	path TEXT NOT NULL,
	strategy TEXT NOT NULL,
	-- The Lighthouse category this audit counts against: performance,
	-- accessibility, best-practices or seo.
	category TEXT NOT NULL,
	-- Lighthouse's own audit id, e.g. 'color-contrast'. Stable across versions,
	-- so it is safe to link to docs by it.
	audit_id TEXT NOT NULL,
	title TEXT NOT NULL,
	description TEXT,
	-- 0-100, rounded. An audit that fails outright is 0.
	score INTEGER,
	-- Lighthouse's own summary, e.g. "2 elements found" or "1.2 s".
	display_value TEXT,
	PRIMARY KEY (path, strategy, audit_id)
);

-- The admin page reads worst-first across every page, so the index is on the
-- score rather than on the path it is keyed by.
CREATE INDEX IF NOT EXISTS idx_lighthouse_findings_score ON lighthouse_findings (score);
