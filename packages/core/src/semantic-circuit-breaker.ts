/** In-process circuit breaker for core semantic LLM calls. */
const THRESHOLD = parseInt(
  process.env["MCP_GUARDIAN_SEMANTIC_CIRCUIT_THRESHOLD"] ||
    process.env["GUARDIAN_SEMANTIC_CIRCUIT_THRESHOLD"] ||
    "5",
  10,
);
const RESET_MS = parseInt(
  process.env["MCP_GUARDIAN_SEMANTIC_CIRCUIT_RESET_MS"] ||
    process.env["GUARDIAN_SEMANTIC_CIRCUIT_RESET_MS"] ||
    "60000",
  10,
);

let consecutiveFailures = 0;
let openUntil = 0;

export function isCoreSemanticCircuitOpen(): boolean {
  if (Date.now() < openUntil) return true;
  return false;
}

export function recordCoreSemanticSuccess(): void {
  consecutiveFailures = 0;
  openUntil = 0;
}

export function recordCoreSemanticFailure(_err?: unknown): void {
  consecutiveFailures++;
  if (consecutiveFailures >= THRESHOLD) {
    openUntil = Date.now() + RESET_MS;
  }
}

/** @internal */
export function resetCoreSemanticCircuitForTests(): void {
  consecutiveFailures = 0;
  openUntil = 0;
}
