import { createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';
import {
  matchesConfiguredStore,
  parseLicenseKeyCreated,
  parseOrderRefunded,
  verifyLemonSqueezySignature,
  webhookEventName,
  type LemonSqueezyWebhookPayload,
} from '../lib/lemonsqueezy-webhook';

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

describe('lemonsqueezy-webhook', () => {
  it('verifyLemonSqueezySignature accepts valid HMAC', () => {
    const secret = 'test-webhook-secret';
    const body = '{"meta":{"event_name":"license_key_created"}}';
    const sig = sign(body, secret);
    expect(verifyLemonSqueezySignature(body, sig, secret)).toBe(true);
    expect(verifyLemonSqueezySignature(body, 'bad', secret)).toBe(false);
    expect(verifyLemonSqueezySignature(body, sig, 'wrong')).toBe(false);
  });

  it('webhookEventName prefers meta.event_name', () => {
    const payload: LemonSqueezyWebhookPayload = {
      meta: { event_name: 'license_key_created' },
    };
    expect(webhookEventName(payload, 'order_created')).toBe('license_key_created');
  });

  it('matchesConfiguredStore filters by store id when set', () => {
    const payload: LemonSqueezyWebhookPayload = {
      data: {
        type: 'license-keys',
        id: '1',
        attributes: { store_id: 42, key: 'ABC' },
      },
    };
    expect(matchesConfiguredStore(payload, '42')).toBe(true);
    expect(matchesConfiguredStore(payload, '99')).toBe(false);
    expect(matchesConfiguredStore(payload, undefined)).toBe(true);
  });

  it('parseLicenseKeyCreated extracts key, email, and ids', () => {
    const payload: LemonSqueezyWebhookPayload = {
      data: {
        type: 'license-keys',
        id: 'lk-99',
        attributes: {
          key: ' PRO-KEY-123 ',
          user_email: 'buyer@example.com',
          order_id: 555,
          store_id: 1,
        },
      },
    };
    expect(parseLicenseKeyCreated(payload)).toEqual({
      key: 'PRO-KEY-123',
      email: 'buyer@example.com',
      lsLicenseKeyId: 'lk-99',
      lsOrderId: '555',
    });
  });

  it('parseLicenseKeyCreated returns null without key', () => {
    expect(
      parseLicenseKeyCreated({
        data: { type: 'license-keys', id: '1', attributes: {} },
      }),
    ).toBeNull();
  });

  it('parseOrderRefunded extracts order id', () => {
    expect(
      parseOrderRefunded({
        data: { type: 'orders', id: 'ord-7', attributes: {} },
      }),
    ).toBe('ord-7');
  });
});
