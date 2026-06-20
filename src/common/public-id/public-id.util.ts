import { ulid } from 'ulid';
import { PublicIdPrefix } from './public-id-prefix.enum';

const PUBLIC_ID_PATTERN = /^([a-z]{2})_([0-9A-HJKMNP-TV-Z]{26})$/;

export function generatePublicId(prefix: PublicIdPrefix): string {
  return `${prefix}_${ulid()}`;
}

export function getPrefixFromPublicId(value: string): string | null {
  const match = value.match(PUBLIC_ID_PATTERN);
  return match?.[1] ?? null;
}

export function isValidPublicId(value: string, expectedPrefix?: PublicIdPrefix): boolean {
  const match = value.match(PUBLIC_ID_PATTERN);
  if (!match) {
    return false;
  }

  if (expectedPrefix && match[1] !== expectedPrefix) {
    return false;
  }

  return true;
}
