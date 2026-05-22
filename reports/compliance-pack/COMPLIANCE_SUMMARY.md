# MCP Guardian — Compliance Evidence Summary

Generated: 2026-05-22T14:25:32.466Z

## Security testing

- Corpus eval: n/a pass rate (? cases)
- Security swarm gates: PASS
- Adversarial harness: `pnpm test:adversarial`
- Integration matrix: `pnpm test:integration`

## Enterprise controls (v2.9.3+)

- Multi-tenant logical isolation: `docs/MULTI_TENANCY.md`
- Response DLP modes: `GUARDIAN_RESPONSE_DLP_MODE=block|redact|audit`
- SIEM exporter DLQ: `~/.mcp-guardian/exporter-dlq/pending.jsonl`
- Field encryption: `GUARDIAN_DB_ENCRYPTION_KEY` + optional `GUARDIAN_DB_ENCRYPTION_SALT`
- JWT max lifetime: `GUARDIAN_JWT_MAX_LIFETIME_SEC` (default 86400)
- Token revocation API: `revokeBearerToken()` in `src/auth/token-revocation.ts`
- mTLS hot-reload: `MtlsCertWatcher` + `mtls-agent-registry`
- OPA result schema validation in `opa-policy.ts`
- Cluster rug-pull registry when `REDIS_URL` set

## Packaged artifacts

- ATTACK_MATRIX.md
- DISASTER_RECOVERY.md
- PEN_TEST_REPORT.md
- README.txt
- THREAT_MODEL.md
- adversarial-harness-results.json
- adversarial-harness-summary.md
- attack-learning-eval-metrics.json
- corpus-eval-report.json
- enterprise-findings-fixes-summary.md
- manifest.json

## Operator commands

```bash
pnpm enterprise:preflight
pnpm enterprise:evidence-pack
node scripts/generate-compliance-report.mjs
```

