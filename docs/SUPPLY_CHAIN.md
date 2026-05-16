# Supply Chain Security

This document describes how MCP Guardian manages dependencies, lockfiles, CI verification, and artifact signing. It reflects **current shipped behavior**, not aspirational SLSA levels.

## Dependency highlights

| Package | Role | Policy |
|---------|------|--------|
| `better-sqlite3` | Native SQLite (WAL history DB) | Stay on latest release that bundles SQLite **≥ 3.50.2** (patched inherited CVEs). v12.10.0+ ships SQLite 3.53.x. |
| `jose` | JWT/JWK (OAuth, DPoP, dashboard) | **≥ 4.15.5** (CVE-2024-28176). Current line: **6.x**. |
| `@modelcontextprotocol/sdk` | MCP protocol | Review on each minor bump. |

### SQLite inherited CVEs

`better-sqlite3` compiles a **bundled** SQLite amalgamation. Application code does not link the OS `libsqlite3`. Security fixes require upgrading `better-sqlite3`, not only the host OS package.

**Upgrade path:** bump `better-sqlite3` in root `package.json`, run `pnpm install`, verify with `node -e "require('better-sqlite3')(':memory:').prepare('select sqlite_version()').pluck().get()"` after build, run full test suite, note version in `CHANGELOG.md`.

## Lockfile policy

- **`pnpm-lock.yaml`** is committed at the repo root and is the single source of truth for CI, Docker, and local dev.
- **npm publish** ships only built artifacts (`dist/`, `assets/`, policy YAML, docs per `package.json` `files`). The lockfile is **not** published to npm; consumers install the prebuilt tarball.
- **CI / Docker:** always `pnpm install --frozen-lockfile` (see `.github/workflows/ci.yml`, `supply-chain.yml`, `Dockerfile`).

## CI: audit and SBOM

| Workflow | What it does |
|----------|----------------|
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | `pnpm audit --audit-level=high` (fails on HIGH/CRITICAL) |
| [`.github/workflows/supply-chain.yml`](../.github/workflows/supply-chain.yml) | Frozen install, build, test, audit, CycloneDX SBOM artifact (`sbom.cdx.json`, 90-day retention) |

Run locally:

```bash
pnpm install --frozen-lockfile
pnpm audit --audit-level=high
pnpm dlx @cyclonedx/cyclonedx-npm --output-file sbom.cdx.json --omit dev
```

## Container signing (Cosign)

On version tags (`v*`), [`.github/workflows/docker-publish.yml`](../.github/workflows/docker-publish.yml) pushes to `ghcr.io/rudraneel93/mcp-guardian` and **keylessly signs** images with [Sigstore Cosign](https://docs.sigstore.dev/) (`sigstore/cosign-action`).

Verify after pull:

```bash
cosign verify ghcr.io/rudraneel93/mcp-guardian:v2.5.8 \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp '^https://github\.com/rudraneel93/mcp-guardian/'
```

## npm provenance and SLSA

| Capability | Status |
|------------|--------|
| npm publish with `--provenance` | **Shipped** on tag publish ([`publish.yml`](../.github/workflows/publish.yml)) |
| GitHub `attest-build-provenance` for `dist/` | **Shipped** for root package artifacts after publish |
| SLSA Level 3 generator / full reproducible builds | **Planned** — not claimed. See template below. |

We do **not** claim [SLSA Level 3](https://slsa.dev/spec/v1.0/levels) until builds are hermetic and fully reproducible end-to-end.

### Template: SLSA GitHub generator (future)

When ready to adopt the official generator on releases:

```yaml
# Snippet for a future release workflow — not active until hermetic builds are verified.
- uses: slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@v2.0.0
  with:
    base64-subjects: "${{ steps.hash.outputs.digest }}"
    upload-assets: true
```

## Reporting dependency issues

See [SECURITY.md](../SECURITY.md#dependency-supply-chain) for how to report vulnerable dependencies or supply-chain concerns.
