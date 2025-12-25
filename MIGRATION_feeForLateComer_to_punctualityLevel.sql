-- =====================================================
-- Migration Script: Change feeForLateComer to punctualityLevel
-- =====================================================
-- Description: 
--   This script migrates the 'feeForLateComer' column (DECIMAL) 
--   to 'punctualityLevel' column (BOOLEAN) in the 'travel' table.
--
--   Migration Logic:
--   - If feeForLateComer > 0 → punctualityLevel = TRUE (very punctual)
--   - If feeForLateComer = 0 or NULL → punctualityLevel = FALSE (punctual)
--
--   IMPORTANT: Backup your database before running this script!
-- =====================================================

-- Step 1: Add the new column with default value
ALTER TABLE travel 
ADD COLUMN punctualityLevel BOOLEAN DEFAULT FALSE NOT NULL;

-- Step 2: Migrate existing data
-- Convert feeForLateComer values to punctualityLevel
-- If feeForLateComer > 0, set punctualityLevel = TRUE (very punctual)
-- Otherwise, set punctualityLevel = FALSE (punctual)
UPDATE travel 
SET punctualityLevel = CASE 
    WHEN feeForLateComer > 0 THEN TRUE 
    ELSE FALSE 
END;

-- Step 3: Verify the migration (optional - check results before dropping)
-- Run this query to verify the migration:
-- SELECT 
--     id, 
--     feeForLateComer, 
--     punctualityLevel,
--     CASE 
--         WHEN feeForLateComer > 0 AND punctualityLevel = TRUE THEN 'OK'
--         WHEN (feeForLateComer = 0 OR feeForLateComer IS NULL) AND punctualityLevel = FALSE THEN 'OK'
--         ELSE 'MISMATCH'
--     END as verification
-- FROM travel;

-- Step 4: Drop the old column (ONLY after verifying the migration)
-- Uncomment the line below after you've verified the migration is correct:
-- ALTER TABLE travel DROP COLUMN feeForLateComer;

-- =====================================================
-- Rollback Script (if needed):
-- =====================================================
-- If you need to rollback, run these commands:
--
-- ALTER TABLE travel 
-- ADD COLUMN feeForLateComer DECIMAL(10,2) DEFAULT 0;
--
-- UPDATE travel 
-- SET feeForLateComer = CASE 
--     WHEN punctualityLevel = TRUE THEN 10.00 
--     ELSE 0.00 
-- END;
--
-- ALTER TABLE travel DROP COLUMN punctualityLevel;
-- =====================================================

