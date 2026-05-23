# Adversarial Harness Summary

Generated: 2026-05-23T20:09:55.363Z

## Key metrics

| Metric | Value |
|--------|-------|
| Corpus attacks blocked | 154/154 |
| Corpus benign pass | 74/74 |
| Corpus false positives | 0 |
| Evasion blocked / total | 148/155 |
| Evasion bypassed | 7 |
| Node/Python parity | 472/472 (100.0%) |
| Corpus parity mismatches | 0 |
| Node integration tests | 26/26 |
| Overall harness | PASS |

## Proxy concurrency (ms)

- AsyncSerialQueue p50: 2.34 p95: 2.47
- Proxy handleClientInput p50: 58.06 p95: 104.35

## Test layers

| Layer | Real integration? |
|-------|-------------------|
| Python policy engine | Offline mirror of TS sync pipeline |
| Node corpus eval | Live PolicyEngine (TS) |
| Node proxy tests | Real subprocess MCP + McpProxyServer |
| Secret scanner | Live scanner module |
| Streaming race | Live streaming-inspector |

## Paths

- Harness: `adversarial-harness/`
- Evasion bundle: `adversarial-harness/evasion-attacks.json`
- Reports: `reports/adversarial-harness/`
