import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const PREFIX_V1 = 'genc1:';
const PREFIX_V2 = 'genc2:';
const SALT_LEN = 16;

function deploymentSalt(): Buffer {
  const fromEnv = process.env['GUARDIAN_DB_ENCRYPTION_SALT']?.trim();
  if (fromEnv) {
    return Buffer.from(createHash('sha256').update(fromEnv).digest().subarray(0, SALT_LEN));
  }
  const keyRaw = process.env['GUARDIAN_DB_ENCRYPTION_KEY']?.trim();
  if (keyRaw) {
    return Buffer.from(createHash('sha256').update(`salt:${keyRaw}`).digest().subarray(0, SALT_LEN));
  }
  return Buffer.from(createHash('sha256').update('mcp-guardian-field-v1').digest().subarray(0, SALT_LEN));
}

function deriveKey(raw: string, salt: Buffer): Buffer {
  return scryptSync(raw, salt, 32);
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
  const salt = deploymentSalt();
  const key = deriveKey(keyRaw, salt);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX_V2 + Buffer.concat([salt, iv, tag, enc]).toString('base64');
}

/** Decrypt a value written by encryptField (pass-through when not encrypted). */
export function decryptField(stored: string | null | undefined): string | null {
  if (stored == null || stored === '') return stored ?? null;
  const keyRaw = getFieldEncryptionKey();
  if (!keyRaw) return stored;

  if (stored.startsWith(PREFIX_V2)) {
    const buf = Buffer.from(stored.slice(PREFIX_V2.length), 'base64');
    const salt = buf.subarray(0, SALT_LEN);
    const iv = buf.subarray(SALT_LEN, SALT_LEN + IV_LEN);
    const tag = buf.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
    const data = buf.subarray(SALT_LEN + IV_LEN + TAG_LEN);
    const key = deriveKey(keyRaw, salt);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  if (stored.startsWith(PREFIX_V1)) {
    const key = scryptSync(keyRaw, 'mcp-guardian-field-v1', 32);
    const buf = Buffer.from(stored.slice(PREFIX_V1.length), 'base64');
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const data = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  return stored;
}
