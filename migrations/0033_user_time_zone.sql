-- A user's own display time zone: an IANA name, or NULL for "no personal choice"
-- (the site setting, then the browser, then UTC decide). A column rather than a
-- per-user row in site_settings: it is one value owned by one user, it goes away
-- with the user, and it needs no key-naming convention.
ALTER TABLE users ADD COLUMN time_zone TEXT;
