import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const PREFIX = 'gcp_';
const KEY_BYTES = 32;

export type GeneratedApiKey = {
  plaintext: string;
  prefix: string;
  hash: string;
};

export function generateApiKey(): GeneratedApiKey {
  const secret = randomBytes(KEY_BYTES).toString('base64url');
  const plaintext = `${PREFIX}${secret}`;
  const prefix = plaintext.slice(0, 12);
  const hash = hashApiKey(plaintext);
  return { plaintext, prefix, hash };
}

export function hashApiKey(plaintext: string): string {
  return bcrypt.hashSync(plaintext, 10);
}

export function verifyApiKey(plaintext: string, hash: string): boolean {
  return bcrypt.compareSync(plaintext, hash);
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token.startsWith(PREFIX) ? token : null;
}
