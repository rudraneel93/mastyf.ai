# Adversarial Harness Summary

Generated: 2026-05-21T07:39:22.029Z

## Key metrics

| Metric | Value |
|--------|-------|
| Corpus attacks blocked | 154/154 |
| Corpus benign pass | 74/74 |
| Corpus false positives | 0 |
| Evasion blocked / total | 85/85 |
| Evasion bypassed | 0 |
| Node/Python parity | 402/402 (100.0%) |
| Corpus parity mismatches | 0 |
| Node integration tests | 26/26 |
| Overall harness | PASS |

## Proxy concurrency (ms)

- AsyncSerialQueue p50: 2.13 p95: 3.43
- Proxy handleClientInput p50: 16.75 p95: 30.35

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
