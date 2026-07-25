/** Normalize flight numbers for API responses (e.g. af123 → AF123). */
export function formatFlightNumberForResponse(
  flightNumber: string | null | undefined,
): string {
  if (flightNumber == null) {
    return '';
  }
  const trimmed = flightNumber.trim();
  return trimmed ? trimmed.toUpperCase() : flightNumber;
}
