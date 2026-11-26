-- Two facts a sign-in provider can tell us about an account.
--   email_verified_at  when a provider (Discord) confirmed the address on the account. Nothing typed
--                      into a form sets it, so it is safe to gate things on (store credit, order history).
--   last_login_at      when the person last signed in, kept on the user so it survives logging out
--                      (a logout deletes the session row). Filled from the newest session they still
--                      have, then kept current by every sign-in.
ALTER TABLE users ADD COLUMN email_verified_at TEXT;
ALTER TABLE users ADD COLUMN last_login_at TEXT;
UPDATE users
   SET last_login_at = (SELECT MAX(created_at) FROM sessions s WHERE s.user_id = users.id);
