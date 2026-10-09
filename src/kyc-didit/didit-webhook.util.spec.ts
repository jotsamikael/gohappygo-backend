import * as crypto from 'crypto';
import { verifyDiditWebhookSignature } from './didit-webhook.util';

const SECRET = 'webhook-secret';

function hmacHex(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload, 'utf8').digest('hex');
}

function sortKeys(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map(sortKeys);
  }
  if (data !== null && typeof data === 'object') {
    return Object.keys(data as Record<string, unknown>)
      .sort()
      .reduce((acc: Record<string, unknown>, key) => {
        acc[key] = sortKeys((data as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return data;
}

describe('verifyDiditWebhookSignature', () => {
  const now = Math.floor(Date.now() / 1000);
  const event = {
    webhook_type: 'status.updated',
    timestamp: now,
    session_id: 'ef1abe2e-a339-4170-a320-8327f0354053',
    status: 'Approved',
    vendor_data: '145',
  };
  const rawBody = JSON.stringify(event);

  it('accepts X-Signature-V2 over canonical JSON', () => {
    const canonical = JSON.stringify(sortKeys(event));
    expect(
      verifyDiditWebhookSignature(rawBody, event, {
        'X-Timestamp': String(now),
        'X-Signature-V2': hmacHex(canonical),
      }, SECRET),
    ).toBe('v2');
  });

  it('accepts X-Signature over the raw body', () => {
    expect(
      verifyDiditWebhookSignature(rawBody, event, {
        'x-timestamp': String(now),
        'x-signature': hmacHex(rawBody),
      }, SECRET),
    ).toBe('raw');
  });

  it('accepts legacy x-didit-signature over the raw body', () => {
    expect(
      verifyDiditWebhookSignature(rawBody, event, {
        'x-didit-signature': hmacHex(rawBody),
      }, SECRET),
    ).toBe('raw');
  });

  it('accepts X-Signature-Simple envelope HMAC', () => {
    const canonical = `${event.timestamp}:${event.session_id}:${event.status}:${event.webhook_type}`;
    expect(
      verifyDiditWebhookSignature(rawBody, event, {
        'x-timestamp': String(now),
        'x-signature-simple': hmacHex(canonical),
      }, SECRET),
    ).toBe('simple');
  });

  it('rejects a stale X-Timestamp', () => {
    const stale = String(now - 400);
    const canonical = JSON.stringify(sortKeys(event));
    expect(
      verifyDiditWebhookSignature(rawBody, event, {
        'x-timestamp': stale,
        'x-signature-v2': hmacHex(canonical),
      }, SECRET),
    ).toBe(false);
  });

  it('rejects a missing or wrong secret', () => {
    expect(
      verifyDiditWebhookSignature(rawBody, event, {
        'x-timestamp': String(now),
        'x-signature': hmacHex(rawBody),
      }, ''),
    ).toBe(false);
  });
});
