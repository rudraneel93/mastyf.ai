# Adversarial Test Harness Zip — Fix Summary

**Date:** 2026-05-22  
**Source:** `/Users/rudraneeldas/Downloads/adversarial-test-harness.zip`  
**Target:** `mcp-guardian` @ master (post `36bff07`)

---

## Zip package contents

| Area | Contents |
|------|----------|
| `adversarial_test_harness/` | Standalone Python harness (`run_harness.py`, `policy_engine.py`, `adversarial_attacks.py`, `concurrency_tests.py`, `secret_scanner.py`, `report.json`) |
| `mcp-guardian-master/` | Full repo snapshot + enterprise/SCA reports |
| `mcp-guardian.zip` | Nested archive |
| Next.js UI shell | Dashboard scaffold (not production gate) |

The zip’s **61.4% pass rate** (194/316) on the **minimal bundled Python `policy_engine.py`** is not production truth. Canonical validation is **TypeScript `PolicyEngine` + `default-policy.yaml`** via `pnpm eval` and `adversarial-harness/run-all.sh`.

---

## Findings inventory vs status

### Zip Python harness gaps (report.json false negatives)

| Category | Zip pass rate | Production TS + harness | Status |
|----------|---------------|------------------------|--------|
| SQL/NoSQL (27) | 7.4% | 100% corpus + semantic guards | **Already fixed** in TS; zip port minimal |
| Credential paths (24) | 33% | Path guard + YAML `block-sensitive-paths` | **Already fixed** |
| Shell obfuscation (26) | 27% | Shell tokenizer + YAML patterns | **Already fixed** |
| Prompt injection (4 FN) | 87.5% | `scanToolCallArguments` 32/32 | **Already fixed** |
| Unicode/encoding/semantic evasion | 20–60% | 120/120 evasion probes | **Already fixed** |
| AsyncSerialQueue (zip) | FAIL | Node `AsyncSerialQueue` tests pass | **Zip sim bug**; TS queue correct |

### New gaps fixed this pass (comprehensive harness 635/637 → 637/637)

| ID | Issue | Status | Fix |
|----|-------|--------|-----|
| **ZIP-1** | `gen-token-001` 60k-char blob passed allowlist | **Fixed** | `stuffingEstimate` in `effectiveRequestTokens`; YAML `blob`/`data` size patterns |
| **ZIP-2** | `upload-semantic-13` 60k `data` field passed | **Fixed** | Same token-budget + `data` field pattern |
| **ZIP-3** | `adv-108` `admin'--` evaded after normalization stripped `--` | **Fixed** | `evaluateSemanticGuards` scans **raw + normalized** leaves; YAML `q` field SQL patterns |
| **ZIP-4** | Node/Python parity 436/437 on `adv-108` | **Fixed** | Aligns with ZIP-3 (Node now blocks) |

### Deferred (documented, not zip blockers)

| Item | Notes |
|------|-------|
| Zip standalone `policy_engine.py` | Reference only; in-repo port at `adversarial-harness/python/` mirrors TS |
| **adv-066** (base64 in `search`) | Already blocked by `encoding-evasion-guard` in production |
| H-3 Redlock, L-1/L-2/L-4/L-6 | See `reports/mcp-tests-25-fixes/summary.md` |
| Full LLM semantic (`GUARDIAN_SEMANTIC_ASYNC`) | Optional; not default |

---

## Files changed

| File | Change |
|------|--------|
| `src/policy/policy-engine.ts` | Context-stuffing token estimate (`leafChars >= 40_000`) |
| `src/policy/semantic-guards.ts` | Raw + normalized SQL/path/URL leaf scan |
| `src/policy/strategies/semantic-guards-strategy.ts` | Pass raw arguments into semantic guards |
| `default-policy.yaml` | `q` SQL patterns; `blob`/`data` 50k+ char guards |
| `adversarial-harness/python/policy_engine/policy_engine.py` | Parity token budget |
| `adversarial-harness/python/policy_engine/semantic_guards.py` | Raw + normalized SQL scan |
| `tests/policy/comprehensive-gap-fixes.test.ts` | Regressions for ZIP-1/3 |

---

## Verification

| Command | Result |
|---------|--------|
| `pnpm build` | **Pass** |
| `pnpm vitest run` | **1042 passed** (1 skipped) |
| `GUARDIAN_DISABLE_SEMANTIC=true pnpm exec tsx corpus/run-eval.ts` | **228/228** |
| `adversarial-harness/python/comprehensive_test_harness.py` | **637/637** policy |
| `HARNESS_PYTHON=.venv/bin/python3 compare-node-python.ts` | **437/437** parity |
| `./adversarial-harness/run-all.sh` | **Pass** (corpus 154/154, evasion 120/120, integration 26/26) |

---

## Counts

| Category | Count |
|----------|-------|
| Zip-documented production gaps (mapped) | **4 fixed** |
| Zip minimal-Python-only (N/A production) | **~120** |
| Already fixed (prior mcp-tests-23/25) | **18+** |
| Deferred | **4** |

---

## Remaining gaps (honest)

1. Zip **61%** figure remains valid only for the bundled minimal Python engine — not a production regression signal.
2. `GUARDIAN_DISABLE_SEMANTIC=true` parity mode intentionally skips LLM semantic; regex/semantic guards still run in sync pipeline.
3. Enterprise SCA “30% evidence gaps” (supply chain attestation, scale proof) — documentation, not policy-engine bugs.
