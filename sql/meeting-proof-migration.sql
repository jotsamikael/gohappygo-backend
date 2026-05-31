-- Production migration: meeting proof selfie feature
-- Run manually when NODE_ENV=production (synchronize is false)

-- delivery_proof / delivey_proof_entity table (adjust table name to match TypeORM naming)
ALTER TABLE delivey_proof_entity
  CHANGE COLUMN selfieWithSender cloudinaryPublicId VARCHAR(512) NOT NULL,
  ADD COLUMN uploadedByUserId INT NOT NULL AFTER uploadedAt,
  ADD UNIQUE INDEX uq_delivery_proof_request (requestId),
  ADD UNIQUE INDEX uq_delivery_proof_cloudinary (cloudinaryPublicId);

-- request_entity settle audit fields
ALTER TABLE request_entity
  ADD COLUMN settledAt DATETIME NULL,
  ADD COLUMN settledByUserId INT NULL,
  ADD COLUMN settleAction ENUM('CANCEL_AND_REFUND', 'COMPLETE_AND_RELEASE_FUNDS') NULL,
  ADD COLUMN settleNote VARCHAR(500) NULL;

INSERT INTO request_status_entity (label, status, comment, createdAt, updatedAt)
SELECT 'Proof deadline missed', 'PROOF_DEADLINE_MISSED',
  'No meeting proof uploaded before deadline; awaiting admin settlement',
  NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM request_status_entity WHERE status = 'PROOF_DEADLINE_MISSED'
);
