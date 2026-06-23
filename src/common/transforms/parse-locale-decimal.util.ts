import { Transform } from 'class-transformer';

/**
 * Parses numeric input that may use a comma decimal separator (e.g. "9,9" -> 9.9).
 */
export function parseLocaleDecimal(value: unknown): unknown {
  if (value === null || value === undefined || value === '') {
    return value;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.');
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? value : parsed;
  }

  return value;
}

export function TransformLocaleDecimal(): PropertyDecorator {
  return Transform(({ value }) => parseLocaleDecimal(value));
}
