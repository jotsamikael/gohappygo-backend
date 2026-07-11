/**
 * Round average rating to one decimal place (e.g. 4.53 -> 4.5).
 */
export function roundRatingToTenth(rating: unknown): number | null {
  if (rating === null || rating === undefined || rating === '') {
    return null;
  }

  const numericRating =
    typeof rating === 'number' ? rating : parseFloat(String(rating));

  if (Number.isNaN(numericRating)) {
    return null;
  }

  return Math.round(numericRating * 10) / 10;
}
