# MCP Guardian Penetration Test Report

**Version:** 2.7.5  
**Report date:** 2026-05-17  
**Scope:** Policy engine (`default-policy.yaml`), enterprise LLM/MCP corpus, adversarial unit + E2E tests

---

## Executive summary

Automated corpus evaluation ran **226** tool-call fixtures against `PolicyEngine` with `default-policy.yaml`.

| Metric | Value |
|--------|-------|
| Attack block rate | 100.0% |
| Benign pass rate | 100.0% |
| Precision | 100.0% |
| Recall | 100.0% |
| F1 | 100.0% |
| Status | **PASS** |

### Per-category recall

| Category | Entries | Recall | Failures |
|----------|---------|--------|----------|
| benign | 55 | N/A (benign) | 0 |
| credential-exfil | 23 | 100.0% | 0 |
| cross-tool-chain | 16 | 100.0% | 0 |
| edge-cases | 22 | 100.0% | 0 |
| prompt-injection | 32 | 100.0% | 0 |
| shell-obfuscation | 26 | 100.0% | 0 |
| sql-nosql | 26 | 100.0% | 0 |
| ssrf-url | 26 | 100.0% | 0 |

---

## Performance (proxy benchmarks)

| Metric | Blocking policy |
|--------|-----------------|
| p50 | 580ms |
| p95 | 995ms |
| p99 | 1060ms |
| Threshold | 150ms |
| CI gate | FAIL |

---

## Test coverage

| Suite | Description |
|-------|-------------|
| `tests/policy/adversarial-scenarios.test.ts` | 58+ inline adversarial cases (default-policy) |
| `corpus/run-eval.ts` | 226 enterprise corpus entries |
| `tests/e2e/adversarial-proxy.e2e.test.ts` | 10 corpus attacks through live proxy subprocess |
| `tests/e2e/proxy-with-policy.e2e.test.ts` | Safe pass + block smoke tests |

See [security/ATTACK_MATRIX.md](../security/ATTACK_MATRIX.md) for OWASP MCP / LLM threat mapping.

---

## Methodology

1. **Corpus eval** — each JSON fixture evaluated synchronously via `PolicyEngine.evaluate()`.
2. **E2E proxy** — child process `mcp-guardian proxy` with real `default-policy.yaml`; blocked calls return JSON-RPC `-32001`.
3. **Benchmarks** — 1000 (CI: 100) round-trips; p95 gate on blocking-policy scenario.

---

## Regenerate

```bash
pnpm build && pnpm eval
BENCH_ITERATIONS=100 pnpm exec tsx benchmarks/run.ts
node scripts/generate-pen-test-report.cjs
```
