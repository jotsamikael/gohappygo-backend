/**
 * GDPR account deletion — prior-state audit notes
 *
 * Before AccountDeletionService, DELETE /api/auth/delete only:
 * - blocked ACCEPTED/NEGOCIATING requests
 * - cancelled future demands/travels
 * - called usersRepository.softDelete (PII remained on row)
 *
 * Gaps closed by AccountDeletionService:
 * - PII scrub + tombstone email/phone (Art. 17 erasure)
 * - verification/profile file purge (Cloudinary + DB)
 * - Firebase auth user removal
 * - FCM device token revocation
 * - alerts, bookmarks, verification/password-reset cleanup
 * - message content scrubbing
 * - support request email redaction
 * - extended prechecks (pending cancellation, pending payouts)
 * - deletion confirmation email + audit log
 * - register() no longer auto-restores soft-deleted accounts
 * - mappers/queries show stable "Deleted user" placeholder for listing owners
 */

export {};
