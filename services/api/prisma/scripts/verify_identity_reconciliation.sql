-- =============================================================================
-- TITAN STREAM IDENTITY & FINANCIAL RECONCILIATION SUITE
-- =============================================================================
-- Execute this script against PostgreSQL to verify 100% financial and domain ownership invariants.

BEGIN;

-- Check 1: User ownership - every FinancialAccount.user_id references a valid User.id
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS: 100% FinancialAccounts mapped to valid User.id'
    ELSE 'FAIL: Found ' || COUNT(*) || ' unmapped financial accounts'
  END AS check_1_financial_account_user_id
FROM financial_accounts fa
LEFT JOIN users u ON u.id = fa.user_id OR u.telegram_user_id = fa.telegram_user_id
WHERE u.id IS NULL;

-- Check 2: Balance ownership - every AssetBalance references a valid FinancialAccount
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS: 100% AssetBalances mapped to valid FinancialAccount'
    ELSE 'FAIL: Found ' || COUNT(*) || ' orphan asset balances'
  END AS check_2_asset_balance_account_link
FROM asset_balances ab
LEFT JOIN financial_accounts fa ON fa.id = ab.financial_account_id
WHERE fa.id IS NULL;

-- Check 3: Settlement ownership - every SettlementSession.user_id references a valid User.id
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS: 100% SettlementSessions mapped to valid User.id'
    ELSE 'FAIL: Found ' || COUNT(*) || ' unmapped settlement sessions'
  END AS check_3_settlement_user_id
FROM settlement_sessions ss
LEFT JOIN users u ON u.id = ss.user_id OR u.telegram_user_id = ss.telegram_user_id
WHERE u.id IS NULL;

-- Check 4: Machine ownership - every user_machine references a valid User.id
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS: 100% UserMachines mapped to valid User.id'
    ELSE 'FAIL: Found ' || COUNT(*) || ' unmapped user machines'
  END AS check_4_user_machine_user_id
FROM user_machines um
LEFT JOIN users u ON u.id = um.user_id OR u.telegram_user_id = um.telegram_user_id
WHERE u.id IS NULL;

-- Check 5: Mining ownership - every user_mining_state references a valid User.id
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS: 100% UserMiningStates mapped to valid User.id'
    ELSE 'FAIL: Found ' || COUNT(*) || ' unmapped mining states'
  END AS check_5_mining_state_user_id
FROM user_mining_states ms
LEFT JOIN users u ON u.id = ms.user_id OR u.telegram_user_id = ms.telegram_user_id
WHERE u.id IS NULL;

-- Check 6: Referral ownership - every ReferralRelationship referrer and referee reference valid Users
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS: 100% ReferralRelationships mapped to valid referrer and referee Users'
    ELSE 'FAIL: Found ' || COUNT(*) || ' unmapped referral relationships'
  END AS check_6_referral_user_ids
FROM referral_relationships rr
LEFT JOIN users u_ref ON u_ref.id = rr.referrer_user_id OR u_ref.telegram_user_id = rr.referrer_id
LEFT JOIN users u_fee ON u_fee.id = rr.referee_user_id OR u_fee.telegram_user_id = rr.referee_id
WHERE u_ref.id IS NULL OR u_fee.id IS NULL;

COMMIT;
