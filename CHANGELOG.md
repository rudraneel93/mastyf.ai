# Changelog

All notable changes to MCP Guardian will be documented in this file.

## [2.1.2] - 2026-05-11

### Fixed
- oauth.ts TypeScript type error (`ReturnType` → `jose.createRemoteJWKSet`)
- Memory leaks in policy engine and proxy rate counters (LRUCache with TTL)
- README version reference (v2.0.0 → v2.1.2)
- `mcp-guardian://latest-scan` now reads real data from database
- scan-mcp.yml CI workflow references published package

### Added
- `glama.json` metadata for Glama registry
- Zod validation schemas (`src/validation/schemas.ts`)
- YAML config parsing support (`.yaml`/`.yml` files)
- Dashboard login rate limiting (5 attempts/min/IP via LRUCache)
- Dockerfile hardened: multi-stage build, non-root user, health check
- Docker build + Trivy security scan in CI
- Dynamic version from `npm_package_version`

## [2.1.0] - 2026-05-10

### Added
- Three-layer detection engine: regex triage → schema analysis → LLM semantic verdict
- Monorepo architecture (pnpm workspace, 3 packages)
- Tamper-resistant manifest (HMAC-SHA256)
- Red-team corpus with precision/recall CI gate
- HTTP/SSE transparent proxy for cost auditing
- Transitive dependency CVE scanning (npm ls --json)
- 40+ secret patterns (AWS, Azure, GCP, Stripe, Slack, Twilio, etc.)
- Per-provider token counting with `isEstimate` flag
- CVE triage (direct vs transitive classification)
- Child-process watchdog (30s timeout, auto-restart)
- Data retention (hourly purge, 30-day TTL)
- Dashboard CSP + HSTS via helmet middleware
- Scoring formula: positive bonuses, clamped 0-100
- Coverage enforcement in CI (40% threshold)
- Helm chart CI/CD workflow

### Changed
- Token counter: provider-specific counting strategies
- Secret scanner: expanded from 6 to 40+ patterns
- Scoring model: add positive bonuses and floor clamping
- Policy engine: LRUCache-backed rate counters

## [2.0.0] - 2026-05-10

### Added
- Monorepo structure: `@mcp-guardian/core`, `@mcp-guardian/cli`, `@mcp-guardian/server`
- Three-layer detection engine (regex + schema + LLM semantic)
- Tamper-resistant manifest with HMAC-SHA256
- Red-team corpus (4 poisoned + 1 benign + run-eval.ts)
- Transport layer (stdio + HTTP/SSE tool fetching)
- Corpus evaluation with nightly CI
- Provenance-signed npm publishing
- CLI package with --fail-on-critical, --json, --verbose
- Server package with scan_mcp_tools + verify_manifest

### Breaking
- Moved to pnpm workspace monorepo from single package
- Root package renamed to avoid namespace collision with server package
- CLI entry point restructured for monorepo

## [1.3.0] - 2026-05-09

### Added
- E2E proxy tests with real default-policy.yaml
- Supply chain CI pipeline (npm audit, CycloneDX SBOM, provenance)
- mTLS zero-trust networking for proxy ↔ upstream
- Operational runbooks (7 scenarios with SLOs)
- Disaster recovery plan (RTO/RPO, backup strategy, recovery drills)

### Fixed
- GitHub language detection corrected to TypeScript
- npm keywords expanded to 22 terms

## [1.2.0] - 2026-05-09

### Added
- Payload normalization layer (URL/hex/unicode/HTML entity decode)
- Semantic shell AST analysis (command substitution, pipe chains, redirects)
- Dashboard authentication (JWT sessions, API keys, CSRF protection)
- Dashboard login rate limiting

### Changed
- Policy engine: normalized payloads before regex evaluation
- Policy engine: semantic analysis integrated into evaluate() pipeline

## [1.0.0] - 2026-05-08

### Added
- Web dashboard with live Prometheus metrics and policy editor
- Redis session cache for cross-replica HA
- Redis shared rate limit counters
- DPoP (RFC 9449) sender-constrained token support
- OpenTelemetry distributed tracing (OTLP)
- HTTP/SSE proxy server for remote MCP transport
- Proxy interceptor with circuit breaker
- Benchmark suite with real proxy overhead measurements
- Helm chart for Kubernetes deployment
- 97 tests across 13 suites

### Changed
- Production-grade scoring with performance benchmarks
- Published to npm as `@mcp-guardian/server@1.0.0`

## [0.7.0] - 2026-05-08

### Added
- Redis session cache for multi-replica HA deployments
- Prometheus metrics endpoint (counters, gauges, histograms)
- E2E integration tests (real MCP server through proxy)
- Prometheus + Grafana dashboard configuration

## [0.6.0] - 2026-05-08

### Added
- Session-based replay protection (5-min session tokens)
- Nonce tracking for JWT replay detection
- Hot-reload policies (chokidar file watcher)
- PolicyAuditor for compliance audit trail
- Formal threat model documentation (THREAT_MODEL.md)

## [0.5.0] - 2026-05-08

### Added
- OAuth 2.1/OIDC JWT authentication for proxy
- OIDC Discovery (RFC 8414) with JWKS caching
- Bearer token extraction and validation
- Agent identity mapping from JWT claims

## [0.4.0] - 2026-05-08

### Added
- Active policy engine (YAML-configurable)
- Structured JSON logging (pino) for SIEM ingestion
- STRIDE threat model documentation
- Command injection validation (10 patterns)
- 74 tests across multiple suites

## [0.3.0] - 2026-05-08

### Added
- Dependency Injection container (IoC pattern)
- Token-bucket rate limiter
- TLS certificate validation
- Full JSON-RPC 2.0 state machine
- SSE/HTTP transport probing
- GitHub Actions CI (Node 18/20/22 matrix)
- 52 unit tests across 6 modules

### Changed
- Package name: `@mcp-doctor/server` → `@mcp-guardian/server`
- SQLite backend: `better-sqlite3` → `sql.js` (pure JS)
- 6 alert threshold CLI flags with exit codes

## [0.1.0] - 2026-05-07

### Added
- Initial release
- Core security scanning (CVE, auth, typo-squat, secrets)
- Cost auditing with multi-model pricing
- Health monitoring
- MCP server entry point (stdio, 4 tools)
- CLI wrapper (scan, audit, health, report)
- Config parser for Cline, Claude Desktop, Cursor, Windsurf