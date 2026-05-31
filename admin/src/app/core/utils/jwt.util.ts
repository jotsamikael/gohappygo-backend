/** Decode JWT payload without verifying signature (client-side expiry checks only). */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Returns expiry timestamp in ms, or null if unavailable. */
export function getTokenExpiryMs(token: string | null | undefined): number | null {
  if (!token) {
    return null;
  }
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp !== 'number') {
    return null;
  }
  return exp * 1000;
}

/** True when token is missing, malformed, or past its exp claim (with optional skew). */
export function isAccessTokenExpired(
  token: string | null | undefined,
  skewMs = 30_000,
): boolean {
  const expiryMs = getTokenExpiryMs(token);
  if (!expiryMs) {
    return true;
  }
  return Date.now() >= expiryMs - skewMs;
}

/** Milliseconds until refresh should run (default: 60s before expiry). */
export function msUntilRefresh(
  token: string | null | undefined,
  refreshBeforeMs = 60_000,
): number | null {
  const expiryMs = getTokenExpiryMs(token);
  if (!expiryMs) {
    return null;
  }
  return Math.max(expiryMs - Date.now() - refreshBeforeMs, 0);
}
