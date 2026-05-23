-- Registered self-hosted Guardian instances (heartbeat from org API keys)

CREATE TABLE IF NOT EXISTS guardian_fleet_instances (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  instance_id TEXT NOT NULL,
  instance_name TEXT,
  region TEXT,
  version TEXT,
  hostname TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  metrics_snapshot JSONB NOT NULL DEFAULT '{}',
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, instance_id)
);

CREATE INDEX IF NOT EXISTS idx_guardian_fleet_org ON guardian_fleet_instances (org_id, last_heartbeat DESC);
CREATE INDEX IF NOT EXISTS idx_guardian_fleet_region ON guardian_fleet_instances (org_id, region);
