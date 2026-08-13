-- =============================================================================
-- FOLLOW-UP MIGRATION: NULLABLE TELEGRAM USER ID & REFERRAL UUID BACKFILL
-- Migration ID: 20260813020000_nullable_telegram_user_id
-- Target: Titan Stream Core Identity & Referral Graph
-- Invariant: Zero balance changes, zero orphan records, enable provider-neutral users
-- =============================================================================

-- 1. Make users.telegram_user_id nullable to allow WhatsApp-only signup
ALTER TABLE users ALTER COLUMN telegram_user_id DROP NOT NULL;

-- 2. Add parallel UUID columns to referral_relationships
ALTER TABLE referral_relationships ADD COLUMN IF NOT EXISTS referrer_user_id TEXT;
ALTER TABLE referral_relationships ADD COLUMN IF NOT EXISTS referee_user_id TEXT;

-- 3. Backfill referral_relationships referrer_user_id and referee_user_id from users.id
UPDATE referral_relationships r
SET referrer_user_id = u.id
FROM users u
WHERE r.referrer_id = u.telegram_user_id AND r.referrer_user_id IS NULL;

UPDATE referral_relationships r
SET referee_user_id = u.id
FROM users u
WHERE r.referee_id = u.telegram_user_id AND r.referee_user_id IS NULL;

-- 4. Create indexes for fast UUID lookups on referral relationships
CREATE INDEX IF NOT EXISTS referral_relationships_referrer_user_id_idx ON referral_relationships(referrer_user_id);
CREATE INDEX IF NOT EXISTS referral_relationships_referee_user_id_idx ON referral_relationships(referee_user_id);
