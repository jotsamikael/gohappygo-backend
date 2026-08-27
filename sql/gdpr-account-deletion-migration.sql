-- GDPR account deletion: user account state + audit log
-- Run manually when NODE_ENV=production (synchronize is false)

ALTER TABLE user_entity
  ADD COLUMN accountStatus ENUM('active', 'anonymized', 'deletion_pending') NOT NULL DEFAULT 'active' AFTER stripeCountryCode,
  ADD COLUMN anonymizedAt TIMESTAMP NULL DEFAULT NULL AFTER accountStatus,
  ADD COLUMN deletionRequestedAt TIMESTAMP NULL DEFAULT NULL AFTER anonymizedAt,
  ADD COLUMN originalEmailHash VARCHAR(64) NULL DEFAULT NULL AFTER deletionRequestedAt;

CREATE TABLE IF NOT EXISTS account_deletion_audit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  requestedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completedAt TIMESTAMP NOT NULL,
  requestIp VARCHAR(45) NULL,
  appVersion VARCHAR(64) NULL,
  originalEmailHash VARCHAR(64) NULL,
  KEY idx_account_deletion_audit_user (userId),
  KEY idx_account_deletion_audit_completed (completedAt)
);
