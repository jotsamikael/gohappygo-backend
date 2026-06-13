-- Production migration: FCM device token storage
-- Run manually when NODE_ENV=production (synchronize is false)

CREATE TABLE IF NOT EXISTS user_device_token (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  fcmToken VARCHAR(512) NOT NULL,
  platform ENUM('ios', 'android') NOT NULL,
  deviceId VARCHAR(128) NULL,
  lastUsedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_fcm_token (fcmToken),
  KEY idx_user_id (userId),
  CONSTRAINT fk_device_token_user FOREIGN KEY (userId) REFERENCES user_entity(id) ON DELETE CASCADE
);
