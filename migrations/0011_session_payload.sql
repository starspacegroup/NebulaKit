-- Migration: move the session payload server-side
-- The session cookie used to carry the whole user object as unsigned base64
-- JSON, so anyone could forge one with isAdmin/isOwner set and take over admin.
-- The fix keeps the cookie as an opaque session id (already a random UUID in
-- the sessions table) and stores the trusted payload here, read back on every
-- request. A forged cookie now names a session that does not exist.
--
-- Nullable and additive: existing session rows (written for activity tracking)
-- keep working, and the per-user session COUNT in the admin UI is unaffected.

ALTER TABLE sessions ADD COLUMN data TEXT;
