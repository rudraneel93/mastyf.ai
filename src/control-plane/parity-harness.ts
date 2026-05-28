export interface ParityFixture {
  id: string;
  method?: string;
  toolName: string;
  arguments?: Record<string, unknown>;
}

export interface TargetRunResult {
  status: number;
  blocked: boolean;
  body: unknown;
}

export interface ParityMismatch {
  id: string;
  toolName: string;
  legacyBlocked: boolean;
  dataPlaneBlocked: boolean;
  legacyStatus: number;
  dataPlaneStatus: number;
}

export interface ParitySummary {
  fixtures: number;
  compared: number;
  mismatches: number;
  legacyProxy: string;
  dataPlane: string;
}

export function validateFixtureCount(fixtures: unknown[]): void {
  if (!Array.isArray(fixtures) || fixtures.length < 20 || fixtures.length > 50) {
    throw new Error('Parity harness requires 20-50 fixtures');
  }
}

export function extractBlocked(responseBody: unknown, statusCode: number): boolean {
  if (statusCode >= 400) return true;
  if (!responseBody || typeof responseBody !== 'object') return false;
  const message = String((responseBody as { error?: { message?: string } })?.error?.message || '');
  return /blocked|denied/i.test(message);
}

export async function compareParity(
  fixtures: ParityFixture[],
  legacyRunner: (fx: ParityFixture) => Promise<TargetRunResult>,
  dataPlaneRunner: (fx: ParityFixture) => Promise<TargetRunResult>,
  legacyProxy: string,
  dataPlane: string,
): Promise<{ summary: ParitySummary; mismatches: ParityMismatch[] }> {
  validateFixtureCount(fixtures);

  const mismatches: ParityMismatch[] = [];
  let compared = 0;

  for (const fx of fixtures) {
    const [legacy, dp] = await Promise.all([legacyRunner(fx), dataPlaneRunner(fx)]);
    compared += 1;
    if (legacy.blocked !== dp.blocked) {
      mismatches.push({
        id: fx.id,
        toolName: fx.toolName,
        legacyBlocked: legacy.blocked,
        dataPlaneBlocked: dp.blocked,
        legacyStatus: legacy.status,
        dataPlaneStatus: dp.status,
      });
    }
  }

  return {
    summary: {
      fixtures: fixtures.length,
      compared,
      mismatches: mismatches.length,
      legacyProxy,
      dataPlane,
    },
    mismatches,
  };
}
