CREATE TABLE IF NOT EXISTS installations (
  id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL,
  redirect_url TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (installation_id) REFERENCES installations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS facebook_pages (
  installation_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  name TEXT NOT NULL,
  picture_url TEXT DEFAULT '',
  token_cipher TEXT NOT NULL,
  token_status TEXT NOT NULL DEFAULT 'active',
  is_default INTEGER NOT NULL DEFAULT 0,
  connected_at INTEGER NOT NULL,
  checked_at INTEGER,
  PRIMARY KEY (installation_id, page_id),
  FOREIGN KEY (installation_id) REFERENCES installations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_facebook_pages_installation
  ON facebook_pages(installation_id);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expiry
  ON oauth_states(expires_at);
