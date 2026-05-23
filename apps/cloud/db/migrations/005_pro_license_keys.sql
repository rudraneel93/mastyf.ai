-- Lemon Squeezy / manual Pro license keys (hashed at rest)

CREATE TABLE IF NOT EXISTS pro_license_keys (
  id TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'lemonsqueezy',
  purchaser_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pro_license_keys_hash ON pro_license_keys(key_hash);
