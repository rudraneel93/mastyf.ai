import { createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import { getDb } from './db';
import { proLicenseKeys } from './db/schema';

export function hashProLicenseKey(plaintext: string): string {
  const secret = process.env.AUTH_SECRET ?? 'dev';
  return createHash('sha256').update(`${secret}:pro:${plaintext}`).digest('hex');
}

export async function findProLicenseByPlaintext(
  plaintext: string,
): Promise<typeof proLicenseKeys.$inferSelect | null> {
  const keyHash = hashProLicenseKey(plaintext);
  return (
    (await getDb().query.proLicenseKeys.findFirst({
      where: eq(proLicenseKeys.keyHash, keyHash),
    })) ?? null
  );
}
