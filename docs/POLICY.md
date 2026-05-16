# Policy evaluation

MCP Guardian evaluates each `tools/call` through layered policy sources. When multiple sources disagree, precedence is **fixed and deterministic**.

## Evaluation order

1. **OPA / Rego** (highest) — When `OPA_URL` is set, POST the call context to OPA. If OPA returns `allow: false`, the request is **blocked immediately** with rule `opa`. OPA does not short-circuit YAML on allow; it only wins on **block**.
2. **YAML `PolicyEngine` rules** — Allow/deny lists, regex, arg patterns, RBAC, rate limits, semantic guards.
3. **`default_action`** — Applied when no YAML rule matches (omit for fail-open; set `block` for fail-closed).

## OPA unavailable

| Condition | Behavior |
|-----------|----------|
| `OPA_URL` unset | Skip OPA; YAML only |
| HTTP error / timeout | Fall through to YAML |
| `GUARDIAN_STRICT_MODE=true` and OPA unreachable | Block (`opa` rule) |

## Examples

| OPA | YAML | Result |
|-----|------|--------|
| block | pass | **block** (OPA) |
| block | block | **block** (OPA — same outcome, OPA reason) |
| pass / no decision | block | **block** (YAML) |
| pass / no decision | pass | **pass** |

Implementation: `src/policy/policy-precedence.ts`, `PolicyEngine.evaluateAsync()`.
