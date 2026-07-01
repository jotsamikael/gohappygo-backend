-- Production migration: admin dispute resolution (RESOLVED status)
-- Run manually when NODE_ENV=production (synchronize is false)

ALTER TABLE request_entity
  ADD COLUMN disputeResolvedAt DATETIME NULL,
  ADD COLUMN disputeResolvedByUserId INT NULL,
  ADD COLUMN disputeResolutionNote VARCHAR(500) NULL;

INSERT INTO request_status_entity (label, status, comment, createdAt, updatedAt)
SELECT 'Resolved', 'RESOLVED',
  'Cancellation dispute closed by admin after manual review and payment handling',
  NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM request_status_entity WHERE status = 'RESOLVED'
);
