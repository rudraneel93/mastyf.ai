# Redis HA for multi-replica Guardian

Guardian uses Redis for:

- **Rate limits** — atomic `INCR` per policy rule (`maxCallsPerMinute`)
- **DPoP jti store** — `SET NX` replay protection
- **Session cache** — cross-pod session tokens
- **LLM cache** — optional semantic/LLM response cache

Use **one Redis deployment per region**. Do not run active-active Redis across regions (>80ms RTT breaks distributed locks).

## Connection modes

| Mode | Environment | Example |
|------|-------------|---------|
| Single | `REDIS_URL` | `redis://redis-master:6379` or **`rediss://`** for TLS |
| Sentinel | `REDIS_SENTINELS` + `REDIS_SENTINEL_MASTER_NAME` | `sentinel-0:26379,sentinel-1:26379` + `mymaster` |
| Cluster | `REDIS_CLUSTER_NODES` | `redis-0:6379,redis-1:6379,redis-2:6379` |

Optional: `REDIS_PASSWORD` for auth.

### TLS in transit

| Variable | Effect |
|----------|--------|
| `rediss://` in `REDIS_URL` | TLS enabled (ioredis native) |
| `GUARDIAN_REDIS_TLS=true` | Upgrades `redis://` → `rediss://` and sets `tls` options |
| `GUARDIAN_REDIS_TLS_REJECT_UNAUTHORIZED=false` | Dev only — accept self-signed certs |

Production: prefer **`rediss://`** endpoints from your cloud Redis offering.

Priority if multiple are set: **Cluster** > **Sentinel** > **URL**.

## Sentinel (recommended for HA)

```bash
export REDIS_SENTINELS=sentinel-0.redis.svc:26379,sentinel-1.redis.svc:26379,sentinel-2.redis.svc:26379
export REDIS_SENTINEL_MASTER_NAME=mymaster
export REDIS_PASSWORD=your-secret
export GUARDIAN_STRICT_MODE=true
```

Helm: disable bundled Redis and inject env from your secret (see `templates/redis-sentinel-notes.yaml`).

## Cluster

```bash
export REDIS_CLUSTER_NODES=redis-0:6379,redis-1:6379,redis-2:6379
export GUARDIAN_STRICT_MODE=true
```

Guardian uses a single ioredis `Cluster` client (`src/utils/redis-client.ts`). Hash tags are not required for rate-limit keys today; keep all Guardian pods on the same cluster endpoint list.

**Smoke test (no live cluster):** `pnpm test tests/utils/redis-client.test.ts` validates `parseClusterNodes` and mode priority. For a live cluster, use your operator’s Redis Cluster chart or `docker run` three nodes, export `REDIS_CLUSTER_NODES`, and run `pnpm enterprise:preflight`.

## Strict mode

With `GUARDIAN_STRICT_MODE=true`, Guardian exits at startup in Kubernetes / multi-replica when Redis is unreachable or not configured.

## Implementation

Client factory: `src/utils/redis-client.ts` (ioredis Sentinel / Cluster / URL).
