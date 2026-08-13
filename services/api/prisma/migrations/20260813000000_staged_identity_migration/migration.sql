-- =============================================================================
-- STAGED IDENTITY MIGRATION: TELEGRAM-CENTRIC TO PROVIDER-NEUTRAL UNIVERSAL IDENTITY
-- Migration ID: 20260813000000_staged_identity_migration
-- Target: Titan Stream Core Ledger & Identity Graph
-- Invariant: Zero balance changes, zero orphan records, 100% aggregate preservation
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PHASE 0: INVARIANT SNAPSHOT & BASELINE RECONCILIATION TABLES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS _migration_phase0_baseline (
    snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total_users BIGINT NOT NULL,
    total_financial_accounts BIGINT NOT NULL,
    total_asset_balances BIGINT NOT NULL,
    total_usdt_balance NUMERIC(36, 18) NOT NULL,
    total_ugx_balance NUMERIC(36, 18) NOT NULL,
    total_user_machines BIGINT NOT NULL,
    total_crystal_accounts BIGINT NOT NULL,
    total_crystal_balance BIGINT NOT NULL,
    snapshot_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Record baseline metrics if table is empty
INSERT INTO _migration_phase0_baseline (
    total_users,
    total_financial_accounts,
    total_asset_balances,
    total_usdt_balance,
    total_ugx_balance,
    total_user_machines,
    total_crystal_accounts,
    total_crystal_balance
)
SELECT 
    (SELECT COUNT(*) FROM users),
    (SELECT COUNT(*) FROM financial_accounts),
    (SELECT COUNT(*) FROM asset_balances),
    COALESCE((SELECT SUM(available_balance + locked_balance) FROM asset_balances WHERE asset = 'USDT'), 0),
    COALESCE((SELECT SUM(available_balance + locked_balance) FROM asset_balances WHERE asset = 'UGX'), 0),
    (SELECT COUNT(*) FROM user_machines),
    (SELECT COUNT(*) FROM crystal_accounts),
    COALESCE((SELECT SUM(balance) FROM crystal_accounts), 0)
WHERE NOT EXISTS (SELECT 1 FROM _migration_phase0_baseline);

-- Per-User Financial Snapshot
CREATE TABLE IF NOT EXISTS _migration_phase0_user_balances (
    telegram_user_id BIGINT NOT NULL,
    asset VARCHAR(32) NOT NULL,
    available_balance NUMERIC(36, 18) NOT NULL,
    locked_balance NUMERIC(36, 18) NOT NULL,
    total_earned NUMERIC(36, 18) NOT NULL,
    PRIMARY KEY (telegram_user_id, asset)
);

INSERT INTO _migration_phase0_user_balances (telegram_user_id, asset, available_balance, locked_balance, total_earned)
SELECT telegram_user_id, asset, available_balance, locked_balance, total_earned
FROM asset_balances
ON CONFLICT (telegram_user_id, asset) DO NOTHING;

-- -----------------------------------------------------------------------------
-- PHASE 1: CANONICAL IDENTITY MAPPING ENFORCEMENT
-- -----------------------------------------------------------------------------

-- Step 1.1: Ensure every user has a Universal Identity
INSERT INTO universal_identities (identity_id, display_name, created_at, updated_at)
SELECT 
    gen_random_uuid()::text,
    COALESCE(u.first_name, CONCAT('User_', u.telegram_user_id::text)),
    NOW(),
    NOW()
FROM users u
WHERE u.identity_id IS NULL;

-- Step 1.2: Bind missing identity_id on users table
UPDATE users u
SET identity_id = ui.identity_id
FROM universal_identities ui
WHERE u.identity_id IS NULL 
  AND ui.display_name = COALESCE(u.first_name, CONCAT('User_', u.telegram_user_id::text));

-- Step 1.3: Ensure ChannelIdentity exists for every Telegram user
INSERT INTO channel_identities (channel_identity_id, identity_id, provider, identifier, telegram_id, verified, created_at)
SELECT 
    gen_random_uuid()::text,
    u.identity_id,
    'TELEGRAM'::"IdentityProvider",
    u.telegram_user_id::text,
    u.telegram_user_id::text,
    TRUE,
    NOW()
FROM users u
WHERE u.identity_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM channel_identities ci 
    WHERE ci.provider = 'TELEGRAM'::"IdentityProvider" AND ci.identifier = u.telegram_user_id::text
);

-- -----------------------------------------------------------------------------
-- PHASE 2 & 3: INTRODUCE AND ALIGN User.id = UniversalIdentity.id
-- -----------------------------------------------------------------------------

-- Step 2.1: Add id column to users if not present
ALTER TABLE users ADD COLUMN IF NOT EXISTS id TEXT;

-- Step 3.1: Backfill User.id with identity_id UUID
UPDATE users 
SET id = identity_id
WHERE id IS NULL AND identity_id IS NOT NULL;

-- Step 3.2: Fallback backfill for any remaining user records
UPDATE users
SET id = gen_random_uuid()::text
WHERE id IS NULL;

-- Step 3.3: Set NOT NULL and UNIQUE on users.id
ALTER TABLE users ALTER COLUMN id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_id_unique_idx ON users(id);

-- -----------------------------------------------------------------------------
-- PHASE 4: ADD PARALLEL user_id COLUMNS ACROSS ALL SUBSYSTEMS
-- -----------------------------------------------------------------------------

-- Subsystem 1: Core Financials
ALTER TABLE financial_accounts ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE asset_balances ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE financial_operations ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE financial_idempotency_records ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE financial_domain_events ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE settlement_sessions ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE payment_invoices ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Subsystem 2: Mining & Machines
ALTER TABLE user_mining_states ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE user_machines ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE user_machine_fleet ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE user_asset_licenses ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Subsystem 3: Game Economy & Crystals
ALTER TABLE crystal_accounts ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE crystal_transactions ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE game_profiles ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE game_player_stats ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE game_reward_grants ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE game_challenge_completions ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Subsystem 4: Growth, Referrals & Rewards
ALTER TABLE referral_codes ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE referral_relationships ADD COLUMN IF NOT EXISTS referrer_user_id TEXT;
ALTER TABLE referral_relationships ADD COLUMN IF NOT EXISTS referee_user_id TEXT;
ALTER TABLE referral_qualification_history ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE growth_events ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE user_trust_profiles ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE trust_events ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE user_levels ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE user_benefits ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE benefit_history ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE user_achievements ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Subsystem 5: State, Consent & Support
ALTER TABLE onboarding_progress ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE education_completions ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE user_consents ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE readiness_scores ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE readiness_history ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE user_state_transitions ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE channel_verification_events ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE product_subscriptions ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE admin_notes ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE support_cases ADD COLUMN IF NOT EXISTS user_uuid TEXT;
ALTER TABLE referral_analytics ADD COLUMN IF NOT EXISTS inviter_user_id TEXT;
ALTER TABLE referral_analytics ADD COLUMN IF NOT EXISTS invitee_user_id TEXT;

-- -----------------------------------------------------------------------------
-- PHASE 4.2: BACKFILL user_id COLUMNS FROM users.id
-- -----------------------------------------------------------------------------

-- Core Financials
UPDATE financial_accounts t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE asset_balances t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE financial_operations t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE financial_idempotency_records t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE financial_domain_events t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE settlement_sessions t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE payment_invoices t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;

-- Mining & Machines
UPDATE user_mining_states t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE user_machines t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE user_machine_fleet t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE user_asset_licenses t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;

-- Game Economy & Crystals
UPDATE crystal_accounts t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE crystal_transactions t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE game_sessions t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE game_profiles t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE game_player_stats t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE game_reward_grants t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE game_challenge_completions t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;

-- Growth, Referrals & Rewards
UPDATE referral_codes t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE referral_relationships t SET referrer_user_id = u.id FROM users u WHERE t.referrer_id = u.telegram_user_id AND t.referrer_user_id IS NULL;
UPDATE referral_relationships t SET referee_user_id = u.id FROM users u WHERE t.referee_id = u.telegram_user_id AND t.referee_user_id IS NULL;
UPDATE referral_qualification_history t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE rewards t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE growth_events t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE user_trust_profiles t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE trust_events t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE user_levels t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE user_benefits t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE benefit_history t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE achievements t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE user_achievements t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;

-- State, Consent & Support
UPDATE onboarding_progress t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE education_completions t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE user_consents t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE audit_events t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE readiness_scores t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE readiness_history t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE user_state_transitions t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE notifications t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE notification_preferences t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE user_preferences t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE channel_verification_events t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE product_subscriptions t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE admin_notes t SET user_id = u.id FROM users u WHERE t.telegram_user_id = u.telegram_user_id AND t.user_id IS NULL;
UPDATE support_cases t SET user_uuid = u.id FROM users u WHERE t.user_id = u.telegram_user_id AND t.user_uuid IS NULL;
UPDATE referral_analytics t SET inviter_user_id = u.id FROM users u WHERE t.inviter_id = u.telegram_user_id AND t.inviter_user_id IS NULL;
UPDATE referral_analytics t SET invitee_user_id = u.id FROM users u WHERE t.invitee_id = u.telegram_user_id AND t.invitee_user_id IS NULL;

-- -----------------------------------------------------------------------------
-- PHASE 4.3: INDEX CREATION FOR FAST LOOKUPS BY user_id
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS financial_accounts_user_id_idx ON financial_accounts(user_id);
CREATE INDEX IF NOT EXISTS asset_balances_user_id_idx ON asset_balances(user_id);
CREATE INDEX IF NOT EXISTS financial_operations_user_id_idx ON financial_operations(user_id);
CREATE INDEX IF NOT EXISTS settlement_sessions_user_id_idx ON settlement_sessions(user_id);
CREATE INDEX IF NOT EXISTS user_machines_user_id_idx ON user_machines(user_id);
CREATE INDEX IF NOT EXISTS crystal_accounts_user_id_idx ON crystal_accounts(user_id);
CREATE INDEX IF NOT EXISTS referral_codes_user_id_idx ON referral_codes(user_id);

-- -----------------------------------------------------------------------------
-- PHASE 5: VERIFICATION FUNCTION
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION _verify_staged_identity_migration()
RETURNS TABLE (
    check_name TEXT,
    passed BOOLEAN,
    details TEXT
) AS $$
BEGIN
    -- Check 1: User id population
    RETURN QUERY
    SELECT 
        'users_id_population'::TEXT,
        (COUNT(*) = 0)::BOOLEAN,
        CONCAT('Unpopulated User.id rows: ', COUNT(*)::TEXT)
    FROM users WHERE id IS NULL;

    -- Check 2: Financial Account user_id backfill
    RETURN QUERY
    SELECT 
        'financial_accounts_backfill'::TEXT,
        (COUNT(telegram_user_id) = COUNT(user_id))::BOOLEAN,
        CONCAT('Legacy rows: ', COUNT(telegram_user_id)::TEXT, ', Backfilled rows: ', COUNT(user_id)::TEXT)
    FROM financial_accounts;

    -- Check 3: Asset Balances total equivalence
    RETURN QUERY
    SELECT 
        'asset_balances_equivalence'::TEXT,
        (COUNT(*) = 0)::BOOLEAN,
        CONCAT('Mismatched user balance rows: ', COUNT(*)::TEXT)
    FROM _migration_phase0_user_balances b
    JOIN asset_balances ab ON ab.telegram_user_id = b.telegram_user_id AND ab.asset = b.asset
    WHERE b.available_balance <> ab.available_balance OR b.locked_balance <> ab.locked_balance;
END;
$$ LANGUAGE plpgsql;
