-- @nebulakit/builder: a revision is a copy of a page as it stood after a save.
--
-- The editor's timeline lists these and can put any one back. Saving a page
-- whose content has not changed adds nothing; the store keeps the newest 50
-- per page.

CREATE TABLE IF NOT EXISTS builder_page_revisions (
	id TEXT PRIMARY KEY,
	page_id TEXT NOT NULL,
	title TEXT NOT NULL,
	document TEXT NOT NULL,
	author TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_builder_page_revisions_page
	ON builder_page_revisions (page_id, created_at DESC);
