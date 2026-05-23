import { createHmac, timingSafeEqual } from 'crypto';

export type LemonSqueezyWebhookPayload = {
  meta?: {
    event_name?: string;
    test_mode?: boolean;
    custom_data?: Record<string, unknown>;
  };
  data?: {
    type?: string;
    id?: string;
    attributes?: Record<string, unknown>;
    relationships?: Record<string, { data?: { type?: string; id?: string } }>;
  };
};

export function verifyLemonSqueezySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;
  const digest = Buffer.from(
    createHmac('sha256', secret).update(rawBody).digest('hex'),
    'utf8',
  );
  const signature = Buffer.from(signatureHeader, 'utf8');
  if (digest.length !== signature.length) return false;
  return timingSafeEqual(digest, signature);
}

export function webhookEventName(
  payload: LemonSqueezyWebhookPayload,
  headerEventName: string | null,
): string {
  return (
    payload.meta?.event_name?.trim()
    || headerEventName?.trim()
    || ''
  ).toLowerCase();
}

export function payloadStoreId(payload: LemonSqueezyWebhookPayload): string | undefined {
  const attrs = payload.data?.attributes;
  if (!attrs) return undefined;
  const storeId = attrs.store_id ?? attrs.storeId;
  if (storeId === undefined || storeId === null) return undefined;
  return String(storeId);
}

export function matchesConfiguredStore(
  payload: LemonSqueezyWebhookPayload,
  configuredStoreId: string | undefined,
): boolean {
  if (!configuredStoreId?.trim()) return true;
  const eventStoreId = payloadStoreId(payload);
  if (!eventStoreId) return true;
  return eventStoreId === configuredStoreId.trim();
}

export function parseLicenseKeyCreated(payload: LemonSqueezyWebhookPayload): {
  key: string;
  email?: string;
  lsLicenseKeyId: string;
  lsOrderId?: string;
} | null {
  if (payload.data?.type !== 'license-keys') return null;
  const attrs = payload.data.attributes;
  if (!attrs) return null;
  const key = typeof attrs.key === 'string' ? attrs.key.trim() : '';
  if (!key) return null;
  const lsLicenseKeyId = payload.data.id?.trim();
  if (!lsLicenseKeyId) return null;
  const email =
    typeof attrs.user_email === 'string'
      ? attrs.user_email.trim()
      : typeof attrs.userEmail === 'string'
        ? attrs.userEmail.trim()
        : undefined;
  const orderId = attrs.order_id ?? attrs.orderId;
  const lsOrderId =
    orderId !== undefined && orderId !== null ? String(orderId) : undefined;
  return { key, email, lsLicenseKeyId, lsOrderId };
}

export function parseOrderRefunded(payload: LemonSqueezyWebhookPayload): string | null {
  if (payload.data?.type !== 'orders') return null;
  const orderId = payload.data.id?.trim();
  if (orderId) return orderId;
  const attrs = payload.data.attributes;
  const attrId = attrs?.order_id ?? attrs?.id;
  if (attrId !== undefined && attrId !== null) return String(attrId);
  return null;
}
