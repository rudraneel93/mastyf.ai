/** Experimental AI features (suggestions, baselines, LLM assistant). Off by default in production. */
export function isExperimentalAiEnabled(): boolean {
  return process.env['GUARDIAN_EXPERIMENTAL_AI'] === 'true';
}
