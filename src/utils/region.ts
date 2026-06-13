/**
 * Multi-region labeling — active-passive failover; not active-active replication.
 */
export function getMastyfAiRegion(): string {
  return (
    process.env['MASTYF_AI_REGION'] ||
    process.env['AWS_REGION'] ||
    process.env['GCP_REGION'] ||
    'default'
  );
}

export function getMastyfAiRegionLabels(): Record<string, string> {
  return { region: getMastyfAiRegion() };
}
