import * as crypto from 'crypto';

export function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== wanted) {
      continue;
    }
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }
  return undefined;
}

function shortenFloats(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map(shortenFloats);
  }
  if (data !== null && typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>).map(([key, value]) => [
        key,
        shortenFloats(value),
      ]),
    );
  }
  if (typeof data === 'number' && Number.isFinite(data) && data % 1 === 0) {
    return Math.trunc(data);
  }
  return data;
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

function timingSafeEqualHex(expected: string, received: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(received, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function hmacHex(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

function isFreshTimestamp(timestampHeader: string | undefined): boolean {
  if (!timestampHeader) {
    return false;
  }
  const ts = parseInt(timestampHeader, 10);
  if (Number.isNaN(ts)) {
    return false;
  }
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - ts) <= 300;
}

export type DiditWebhookVerifyResult = 'v2' | 'raw' | 'simple' | false;

export function verifyDiditWebhookSignature(
  rawBody: string,
  parsedBody: Record<string, unknown>,
  headers: Record<string, string | string[] | undefined>,
  secret: string,
): DiditWebhookVerifyResult {
  if (!secret) {
    return false;
  }

  const timestamp = headerValue(headers, 'x-timestamp');
  const signatureV2 = headerValue(headers, 'x-signature-v2');
  const signatureRaw =
    headerValue(headers, 'x-signature') ||
    headerValue(headers, 'x-didit-signature');
  const signatureSimple = headerValue(headers, 'x-signature-simple');
  const timestampOk = isFreshTimestamp(timestamp);

  if (signatureV2 && timestamp && timestampOk) {
    const canonical = JSON.stringify(sortKeys(shortenFloats(parsedBody)));
    if (timingSafeEqualHex(hmacHex(secret, canonical), signatureV2)) {
      return 'v2';
    }
  }

  if (signatureRaw && (!timestamp || timestampOk)) {
    if (timingSafeEqualHex(hmacHex(secret, rawBody), signatureRaw)) {
      return 'raw';
    }
  }

  if (signatureSimple && timestamp && timestampOk) {
    const canonical = [
      parsedBody.timestamp ?? '',
      parsedBody.session_id ?? '',
      parsedBody.status ?? '',
      parsedBody.webhook_type ?? '',
    ].join(':');
    if (timingSafeEqualHex(hmacHex(secret, canonical), signatureSimple)) {
      return 'simple';
    }
  }

  return false;
}
