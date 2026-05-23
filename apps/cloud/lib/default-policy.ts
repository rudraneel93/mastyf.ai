import { DEFAULT_POLICY_YAML } from './default-policy-embedded';

/** Default tenant policy YAML (bundled for Vercel serverless — no filesystem read). */
export function getDefaultPolicyYaml(): string {
  return DEFAULT_POLICY_YAML;
}
