export function toDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function getRequestTravelDateOnly(request: {
  travel?: { travelDate?: Date; departureDatetime?: Date } | null;
  demand?: { travelDate?: Date } | null;
}): Date | null {
  const raw = request.travel
    ? (request.travel as { travelDate?: Date }).travelDate ?? request.travel.departureDatetime
    : request.demand?.travelDate;
  if (!raw) {
    return null;
  }
  return toDateOnly(new Date(raw));
}

/**
 * Same cutoff as autoCompleteRequests: travelDate <= today - autoCompleteDays (date-only).
 */
export function isPastMeetingProofDeadline(
  travelDate: Date | null,
  autoCompleteDays: number,
  today: Date = new Date(),
): boolean {
  if (!travelDate) {
    return false;
  }
  const cutoff = new Date(toDateOnly(today));
  cutoff.setDate(cutoff.getDate() - autoCompleteDays);
  return toDateOnly(travelDate) <= toDateOnly(cutoff);
}

export function isWithinMeetingProofUploadWindow(
  travelDate: Date | null,
  autoCompleteDays: number,
  canBypassTravelDate: boolean,
  today: Date = new Date(),
): boolean {
  if (!travelDate) {
    return false;
  }
  if (isPastMeetingProofDeadline(travelDate, autoCompleteDays, today)) {
    return false;
  }
  const todayOnly = toDateOnly(today);
  if (!canBypassTravelDate && todayOnly < toDateOnly(travelDate)) {
    return false;
  }
  return true;
}
