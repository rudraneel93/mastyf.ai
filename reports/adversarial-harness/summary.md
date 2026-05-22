# Adversarial Harness Summary

Generated: 2026-05-21T19:05:49.089Z

## Key metrics

| Metric | Value |
|--------|-------|
| Corpus attacks blocked | 154/154 |
| Corpus benign pass | 74/74 |
| Corpus false positives | 0 |
| Evasion blocked / total | 120/120 |
| Evasion bypassed | 0 |
| Node/Python parity | 436/437 (99.8%) |
| Corpus parity mismatches | 0 |
| Node integration tests | 26/26 |
| Overall harness | FAIL |

## Proxy concurrency (ms)

- AsyncSerialQueue p50: 2.32 p95: 2.43
- Proxy handleClientInput p50: 55.30 p95: 73.43

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
