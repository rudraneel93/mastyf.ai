import {
  matchesConfiguredStore,
  parseLicenseKeyCreated,
  parseOrderRefunded,
  verifyLemonSqueezySignature,
  webhookEventName,
  type LemonSqueezyWebhookPayload,
} from '@/lib/lemonsqueezy-webhook';
import { registerProLicense, revokeProLicenseByOrderId } from '@/lib/pro-license-register';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('X-Signature');

  if (!verifyLemonSqueezySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: LemonSqueezyWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as LemonSqueezyWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const storeId = process.env.LEMONSQUEEZY_STORE_ID?.trim();
  if (!matchesConfiguredStore(payload, storeId)) {
    return NextResponse.json({ ok: true, skipped: 'store_mismatch' });
  }

  const event = webhookEventName(payload, request.headers.get('X-Event-Name'));

  try {
    if (event === 'license_key_created') {
      const parsed = parseLicenseKeyCreated(payload);
      if (!parsed) {
        return NextResponse.json({ error: 'Missing license key fields' }, { status: 422 });
      }
      const result = await registerProLicense({
        key: parsed.key,
        email: parsed.email,
        lsLicenseKeyId: parsed.lsLicenseKeyId,
        lsOrderId: parsed.lsOrderId,
      });
      return NextResponse.json({
        ok: true,
        event,
        inserted: result.inserted,
        id: result.id,
      });
    }

    if (event === 'order_refunded') {
      const orderId = parseOrderRefunded(payload);
      if (!orderId) {
        return NextResponse.json({ ok: true, event, revoked: 0 });
      }
      const revoked = await revokeProLicenseByOrderId(orderId);
      return NextResponse.json({ ok: true, event, revoked });
    }

    return NextResponse.json({ ok: true, event, ignored: true });
  } catch (err) {
    console.error('[lemonsqueezy-webhook]', event, err);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
