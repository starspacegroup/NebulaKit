-- A ladder instead of a switch, and a named grant per admin area.
--
-- Access was `users.is_admin` plus a configured owner, with one per-admin grant
-- (`can_view_stats`, 0009). That cannot say "this person may edit pages but not
-- manage users", and it let any admin act on any account.
--
-- ROLES. owner > superadmin > admin > user. Only three live in this column.
-- `owner` is deliberately NOT a value of it: the owner is configuration
-- (GITHUB_OWNER_ID, else KV), so no statement the application can run writes
-- the owner's rank, and nobody can demote the owner from inside the site.
--
-- `is_admin` STAYS and is kept in sync (admin or superadmin = 1). The auth
-- hook, the session payload and older code still read it; dropping it here
-- would turn a permissions change into an outage.
--
-- `can_view_stats` STAYS too. It is mirrored into the `stats` permission below
-- and kept in step by the user admin API, so the existing stats gating works
-- unchanged.
--
-- NOBODY LOSES ACCESS ON UPGRADE. Every existing admin keeps every area a plain
-- admin could reach before (listed below), and the stats grant carries over.
-- Areas that were owner-only (api-keys, pii reveal, managing users) are NOT
-- handed to admins: granting those is a decision, not a side effect.
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin', 'superadmin'));

UPDATE users SET role = 'admin' WHERE is_admin = 1;

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id    TEXT NOT NULL,
  permission TEXT NOT NULL,
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- Who granted it. Not a foreign key: deleting the grantor must not revoke
  -- anything from somebody still working.
  granted_by TEXT,
  PRIMARY KEY (user_id, permission),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);

-- One statement per permission: D1 caps the terms in a compound SELECT.
INSERT OR IGNORE INTO user_permissions (user_id, permission, granted_by)
SELECT id, 'cms', 'migration:0021' FROM users WHERE role = 'admin';

INSERT OR IGNORE INTO user_permissions (user_id, permission, granted_by)
SELECT id, 'pages', 'migration:0021' FROM users WHERE role = 'admin';

INSERT OR IGNORE INTO user_permissions (user_id, permission, granted_by)
SELECT id, 'users', 'migration:0021' FROM users WHERE role = 'admin';

INSERT OR IGNORE INTO user_permissions (user_id, permission, granted_by)
SELECT id, 'contact', 'migration:0021' FROM users WHERE role = 'admin';

INSERT OR IGNORE INTO user_permissions (user_id, permission, granted_by)
SELECT id, 'lighthouse', 'migration:0021' FROM users WHERE role = 'admin';

INSERT OR IGNORE INTO user_permissions (user_id, permission, granted_by)
SELECT id, 'stats', 'migration:0021' FROM users WHERE role = 'admin' AND can_view_stats = 1;
