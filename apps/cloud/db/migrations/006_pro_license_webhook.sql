-- Lemon Squeezy webhook idempotency columns

ALTER TABLE pro_license_keys
  ADD COLUMN IF NOT EXISTS ls_license_key_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS ls_order_id TEXT;

CREATE INDEX IF NOT EXISTS idx_pro_license_keys_ls_order_id ON pro_license_keys(ls_order_id);
