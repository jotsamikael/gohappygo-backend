-- Production migration: remove packageKind from demand_entity
-- Run manually when NODE_ENV=production (synchronize is false)

ALTER TABLE demand_entity
  DROP COLUMN packageKind;
