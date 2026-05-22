import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { allLicensedFeatures } from './entitlements';

export type CloudSessionPayload = {
  tenantSlug: string;
  identity: string;
  roles: string[];
  exp: number;
};

export function signCloudSession(payload: Omit<CloudSessionPayload, 'exp'>, ttlSeconds = 86400): string {
  const secret = process.env.LICENSE_JWT_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) throw new Error('LICENSE_JWT_SECRET or AUTH_SECRET required');

  const body: CloudSessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyCloudSession(token: string): CloudSessionPayload | null {
  const secret = process.env.LICENSE_JWT_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expected = createHmac('sha256', secret).update(encoded!).digest('base64url');
  try {
    if (!timingSafeEqual(Buffer.from(sig!), Buffer.from(expected))) return null;
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded!, 'base64url').toString('utf8')) as CloudSessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function generateExchangeToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashExchangeToken(token: string): string {
  const secret = process.env.AUTH_SECRET ?? 'dev';
  return createHmac('sha256', secret).update(token).digest('hex');
}

export function cloudSsoFeatures(): string[] {
  return allLicensedFeatures();
}
