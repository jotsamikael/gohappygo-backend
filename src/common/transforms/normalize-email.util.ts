import { Transform } from 'class-transformer';

export function normalizeEmail(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().toLowerCase();
}

export function NormalizeEmail(): PropertyDecorator {
  return Transform(({ value }) => normalizeEmail(value));
}
