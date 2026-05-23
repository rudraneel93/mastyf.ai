import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { getDb } from './db';
import { proLicenseKeys } from './db/schema';
import { hashProLicenseKey } from './pro-license-keys';

export type RegisterProLicenseInput = {
  key: string;
  email?: string;
  lsLicenseKeyId?: string;
  lsOrderId?: string;
  source?: string;
};

export async function registerProLicense(
  input: RegisterProLicenseInput,
): Promise<{ inserted: boolean; id: string }> {
  const key = input.key.trim();
  if (!key) {
    throw new Error('License key is required');
  }

  const db = getDb();
  const keyHash = hashProLicenseKey(key);
  const id = randomUUID();

  if (input.lsLicenseKeyId) {
    const existing = await db.query.proLicenseKeys.findFirst({
      where: eq(proLicenseKeys.lsLicenseKeyId, input.lsLicenseKeyId),
    });
    if (existing) {
      return { inserted: false, id: existing.id };
    }
  }

  try {
    await db.insert(proLicenseKeys).values({
      id,
      keyHash,
      source: input.source ?? 'lemonsqueezy',
      purchaserEmail: input.email ?? null,
      lsLicenseKeyId: input.lsLicenseKeyId ?? null,
      lsOrderId: input.lsOrderId ?? null,
    });
    return { inserted: true, id };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === '23505' && input.lsLicenseKeyId) {
      const existing = await db.query.proLicenseKeys.findFirst({
        where: eq(proLicenseKeys.lsLicenseKeyId, input.lsLicenseKeyId),
      });
      if (existing) {
        return { inserted: false, id: existing.id };
      }
    }
    throw err;
  }
}

export async function revokeProLicenseByOrderId(lsOrderId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .delete(proLicenseKeys)
    .where(eq(proLicenseKeys.lsOrderId, lsOrderId))
    .returning({ id: proLicenseKeys.id });
  return rows.length;
}
