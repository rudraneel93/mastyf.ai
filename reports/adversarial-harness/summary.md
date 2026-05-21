# Adversarial Harness Summary

Generated: 2026-05-21T07:11:47.838Z

## Key metrics

| Metric | Value |
|--------|-------|
| Corpus attacks blocked | 154/154 |
| Corpus benign pass | 74/74 |
| Corpus false positives | 0 |
| Evasion blocked / total | 85/85 |
| Evasion bypassed | 0 |
| Node/Python parity | 400/402 (99.5%) |
| Corpus parity mismatches | 0 |
| Node integration tests | 26/26 |
| Overall harness | PASS |

## Proxy concurrency (ms)

- AsyncSerialQueue p50: 2.12 p95: 2.25
- Proxy handleClientInput p50: 17.38 p95: 34.60

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
