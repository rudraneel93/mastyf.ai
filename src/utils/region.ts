/**
 * Multi-region labeling — active-passive failover; not active-active replication.
 */
export function getGuardianRegion(): string {
  return (
    process.env['GUARDIAN_REGION'] ||
    process.env['AWS_REGION'] ||
    process.env['GCP_REGION'] ||
    'default'
  );
}

export function getGuardianRegionLabels(): Record<string, string> {
  return { region: getGuardianRegion() };
}
