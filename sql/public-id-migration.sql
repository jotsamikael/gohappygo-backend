-- Production migration: publicId (prefixed ULID) for client-facing entities
-- Run manually when NODE_ENV=production (synchronize is false)
-- After running this script, run: npm run backfill:public-ids
-- Then run the NOT NULL section at the bottom

-- Core user-generated resources
ALTER TABLE user_entity ADD COLUMN publicId VARCHAR(40) NULL;
CREATE UNIQUE INDEX uq_user_entity_public_id ON user_entity(publicId);

ALTER TABLE request_entity ADD COLUMN publicId VARCHAR(40) NULL;
CREATE UNIQUE INDEX uq_request_entity_public_id ON request_entity(publicId);

ALTER TABLE travel_entity ADD COLUMN publicId VARCHAR(40) NULL;
CREATE UNIQUE INDEX uq_travel_entity_public_id ON travel_entity(publicId);

ALTER TABLE demand_entity ADD COLUMN publicId VARCHAR(40) NULL;
CREATE UNIQUE INDEX uq_demand_entity_public_id ON demand_entity(publicId);

ALTER TABLE transaction_entity ADD COLUMN publicId VARCHAR(40) NULL;
CREATE UNIQUE INDEX uq_transaction_entity_public_id ON transaction_entity(publicId);

ALTER TABLE review_entity ADD COLUMN publicId VARCHAR(40) NULL;
CREATE UNIQUE INDEX uq_review_entity_public_id ON review_entity(publicId);

ALTER TABLE message_entity ADD COLUMN publicId VARCHAR(40) NULL;
CREATE UNIQUE INDEX uq_message_entity_public_id ON message_entity(publicId);

ALTER TABLE notification ADD COLUMN publicId VARCHAR(40) NULL;
CREATE UNIQUE INDEX uq_notification_public_id ON notification(publicId);

ALTER TABLE alert_entity ADD COLUMN publicId VARCHAR(40) NULL;
CREATE UNIQUE INDEX uq_alert_entity_public_id ON alert_entity(publicId);

ALTER TABLE bookmark_entity ADD COLUMN publicId VARCHAR(40) NULL;
CREATE UNIQUE INDEX uq_bookmark_entity_public_id ON bookmark_entity(publicId);

ALTER TABLE support_request_entity ADD COLUMN publicId VARCHAR(40) NULL;
CREATE UNIQUE INDEX uq_support_request_entity_public_id ON support_request_entity(publicId);

-- Reference entities (nested in API responses)
ALTER TABLE airport_entity ADD COLUMN publicId VARCHAR(40) NULL;
CREATE UNIQUE INDEX uq_airport_entity_public_id ON airport_entity(publicId);

ALTER TABLE airline_entity ADD COLUMN publicId VARCHAR(40) NULL;
CREATE UNIQUE INDEX uq_airline_entity_public_id ON airline_entity(publicId);

ALTER TABLE currency_entity ADD COLUMN publicId VARCHAR(40) NULL;
CREATE UNIQUE INDEX uq_currency_entity_public_id ON currency_entity(publicId);

ALTER TABLE delivey_proof_entity ADD COLUMN publicId VARCHAR(40) NULL;
CREATE UNIQUE INDEX uq_delivey_proof_entity_public_id ON delivey_proof_entity(publicId);

-- Uploaded files: rename Cloudinary column, add external publicId
ALTER TABLE uploaded_file_entity CHANGE COLUMN publicId cloudinaryPublicId VARCHAR(255) NOT NULL;
ALTER TABLE uploaded_file_entity ADD COLUMN publicId VARCHAR(40) NULL;
CREATE UNIQUE INDEX uq_uploaded_file_entity_public_id ON uploaded_file_entity(publicId);

-- Post-backfill (run ONLY after npm run backfill:public-ids succeeds):
-- ALTER TABLE user_entity MODIFY publicId VARCHAR(40) NOT NULL;
-- ALTER TABLE request_entity MODIFY publicId VARCHAR(40) NOT NULL;
-- ALTER TABLE travel_entity MODIFY publicId VARCHAR(40) NOT NULL;
-- ALTER TABLE demand_entity MODIFY publicId VARCHAR(40) NOT NULL;
-- ALTER TABLE transaction_entity MODIFY publicId VARCHAR(40) NOT NULL;
-- ALTER TABLE review_entity MODIFY publicId VARCHAR(40) NOT NULL;
-- ALTER TABLE message_entity MODIFY publicId VARCHAR(40) NOT NULL;
-- ALTER TABLE notification MODIFY publicId VARCHAR(40) NOT NULL;
-- ALTER TABLE alert_entity MODIFY publicId VARCHAR(40) NOT NULL;
-- ALTER TABLE bookmark_entity MODIFY publicId VARCHAR(40) NOT NULL;
-- ALTER TABLE support_request_entity MODIFY publicId VARCHAR(40) NOT NULL;
-- ALTER TABLE airport_entity MODIFY publicId VARCHAR(40) NOT NULL;
-- ALTER TABLE airline_entity MODIFY publicId VARCHAR(40) NOT NULL;
-- ALTER TABLE currency_entity MODIFY publicId VARCHAR(40) NOT NULL;
-- ALTER TABLE delivey_proof_entity MODIFY publicId VARCHAR(40) NOT NULL;
-- ALTER TABLE uploaded_file_entity MODIFY publicId VARCHAR(40) NOT NULL;
