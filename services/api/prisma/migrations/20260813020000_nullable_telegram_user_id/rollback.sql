-- =============================================================================
-- TITAN STREAM IDENTITY MIGRATION — ROLLBACK & RECOVERY STRATEGY ARTIFACT
-- Migration ID: 20260813020000_nullable_telegram_user_id
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PRE-ROLLBACK INVARIANT CHECK
-- -----------------------------------------------------------------------------
-- Ensure no WhatsApp-only users exist with NULL telegram_user_id before reverting
-- NOT NULL constraint on users.telegram_user_id.

SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'SAFE TO ROLLBACK: Zero WhatsApp-only users with NULL telegram_user_id'
        ELSE 'CANNOT ROLLBACK: Found ' || COUNT(*) || ' users with NULL telegram_user_id'
    END AS rollback_safety_status
FROM users 
WHERE telegram_user_id IS NULL;

-- -----------------------------------------------------------------------------
-- ROLLBACK SEQUENCE (EXECUTE ONLY IF APPROVED AND SAFE)
-- -----------------------------------------------------------------------------

/*
BEGIN;

-- 1. Drop parallel indexes
DROP INDEX IF EXISTS referral_relationships_referrer_user_id_idx;
DROP INDEX IF EXISTS referral_relationships_referee_user_id_idx;

-- 2. Drop parallel UUID columns from referral_relationships
ALTER TABLE referral_relationships DROP COLUMN IF EXISTS referrer_user_id;
ALTER TABLE referral_relationships DROP COLUMN IF EXISTS referee_user_id;

-- 3. Restore NOT NULL constraint on users.telegram_user_id (if all rows have non-null telegram_user_id)
ALTER TABLE users ALTER COLUMN telegram_user_id SET NOT NULL;

COMMIT;
*/
