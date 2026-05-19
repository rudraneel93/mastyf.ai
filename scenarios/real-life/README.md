# Real-life scenario

Config: `mcp-config.json` — mixed stdio/SSE servers, typo-squat package, secrets in env.

## Required environment

| Variable | Purpose |
|----------|---------|
| `NVD_API_KEY` | Optional — higher NVD rate limits for CVE scans |
| `GUARDIAN_MODEL` / server `env` | Model id for cost pricing when proxy records calls |

## Running

```bash
pnpm build
node dist/cli.js scan -c scenarios/real-life/mcp-config.json
node dist/cli.js report -c scenarios/real-life/mcp-config.json --output scenarios/real-life/output/report.json
node scenarios/real-life/run-live-proxy-test.mjs   # populates call_records for cost audit
node dist/cli.js audit -c scenarios/real-life/proxy-test-config.json
```

## CI strict mode

`GUARDIAN_SCAN_STRICT=true` fails scan/report when:

- CVE lookup is `degraded` or `unavailable`
- Any server lacks authentication
- Typo-squat risk is detected

Use in CI after `NVD_API_KEY` is configured for reliable CVE feeds.

## Cost audit (`05-proxy-live`)

After `run-live-proxy-test.mjs`, `mcp-guardian audit` should show **actual** costs from `call_records`. If empty, the note distinguishes “no DB rows” vs “wrong server name”.
