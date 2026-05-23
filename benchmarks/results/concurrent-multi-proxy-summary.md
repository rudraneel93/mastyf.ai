# Concurrent multi-proxy benchmark

**Run:** 2026-05-23T18:36:41.381Z  
**Command:** `pnpm benchmark:multi-proxy`

## Configuration

| Setting | Value |
|---------|--------|
| Replicas (K) | **10** |
| Total calls | **50** |
| Calls per replica | **5** |
| Workload | K forked workers → each `McpProxyServer` + echo |

## Aggregate (global)

| Metric | Value |
|--------|--------|
| Correctness | **100%** |
| p50 | ~940.5 ms |
| p95 | ~1011.3 ms |
| p99 | ~1011.3 ms |
| Wall | 2365 ms |

## Per-replica

| Replica | Calls | Correctness | p95 | Wall (ms) |
|---------|-------|-------------|-----|-----------|
| 0 | 5 | 100% | ~883.4 | 884 |
| 1 | 5 | 100% | ~961.5 | 961 |
| 2 | 5 | 100% | ~910.5 | 911 |
| 3 | 5 | 100% | ~940.5 | 941 |
| 4 | 5 | 100% | ~871.2 | 872 |
| 5 | 5 | 100% | ~1011.3 | 1012 |
| 6 | 5 | 100% | ~877.6 | 878 |
| 7 | 5 | 100% | ~953.5 | 954 |
| 8 | 5 | 100% | ~983.9 | 984 |
| 9 | 5 | 100% | ~942.2 | 942 |

## vs single-proxy 1k burst

| Metric | Single proxy (1k) | Multi-proxy (10×5) | Delta (multi − single) |
|--------|-------------------|--------------------------------------------------|-------------------------|
| p50 | ~27006.111874999995 ms | ~940.5 ms | -26065.6 ms |
| p95 | ~37025.202792 ms | ~1011.3 ms | -36013.9 ms |
| p99 | ~38110.176 ms | ~1011.3 ms | -37098.8 ms |
| Wall | 54030 ms | 2365 ms | -51665 ms |

Multi-replica sharding reduced global p95 vs single-proxy 1k burst (stdio bottleneck).

## Guidance

- **Policy-only** (`benchmark:concurrent`): rule tuning, 1000-way in-process policy.
- **Proxy tiers** (`benchmark:proxy-tiers`): deployment SLOs at 1–50 in-flight.
- **Multi-replica**: stdio serialization bottleneck; lower tail latency when sharded across K processes.

## Machine

- darwin arm64, 10 CPUs, Node v23.11.0

## Artifacts

- JSON: `benchmarks/results/concurrent-multi-proxy-latest.json`
