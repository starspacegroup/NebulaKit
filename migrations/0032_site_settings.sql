-- Generic site-level key/value settings.
--
-- commerce_settings is shop-specific, so site-wide admin preferences get their
-- own table. The first user is the admin time zone: key 'admin_timezone', whose
-- value is an IANA zone name ('Asia/Kolkata') or 'auto'. An absent row means
-- "never configured", which reads as 'auto' (use the browser's zone, else UTC).
-- A key/value table means the next setting needs no migration.

CREATE TABLE IF NOT EXISTS site_settings (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL,
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
