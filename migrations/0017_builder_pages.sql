-- @nebulakit/builder: pages built in the drag-and-drop editor, stored as DATA.
--
-- `document` is a JSON page document (packages/builder/src/schema.ts), never
-- generated code. That is the rule that keeps a client's edits out of the
-- site's code, so NebulaKit updates keep merging cleanly into every site.

CREATE TABLE IF NOT EXISTS builder_pages (
	id TEXT PRIMARY KEY,
	slug TEXT NOT NULL UNIQUE,
	title TEXT NOT NULL,
	document TEXT NOT NULL,
	published INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
