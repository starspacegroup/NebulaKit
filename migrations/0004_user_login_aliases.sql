CREATE TABLE IF NOT EXISTS user_login_aliases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_login_aliases_user_id ON user_login_aliases(user_id);
CREATE INDEX IF NOT EXISTS idx_user_login_aliases_email ON user_login_aliases(email);