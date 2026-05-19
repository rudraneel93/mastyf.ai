import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const PREFIX = 'genc1:';

function deriveKey(raw: string): Buffer {
  return scryptSync(raw, 'mcp-guardian-field-v1', 32);
}

export function isFieldEncryptionEnabled(): boolean {
  return Boolean(process.env['GUARDIAN_DB_ENCRYPTION_KEY']?.trim());
}

export function getFieldEncryptionKey(): string | undefined {
  const k = process.env['GUARDIAN_DB_ENCRYPTION_KEY']?.trim();
  return k || undefined;
}

/** Encrypt a sensitive column value (returns plaintext when key unset). */
export function encryptField(plaintext: string | null | undefined): string | null {
  if (plaintext == null || plaintext === '') return plaintext ?? null;
  const keyRaw = getFieldEncryptionKey();
  if (!keyRaw) return plaintext;
  const key = deriveKey(keyRaw);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64');
}

/** Decrypt a value written by encryptField (pass-through when not encrypted). */
export function decryptField(stored: string | null | undefined): string | null {
  if (stored == null || stored === '') return stored ?? null;
  if (!stored.startsWith(PREFIX)) return stored;
  const keyRaw = getFieldEncryptionKey();
  if (!keyRaw) return stored;
  const key = deriveKey(keyRaw);
  const buf = Buffer.from(stored.slice(PREFIX.length), 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
