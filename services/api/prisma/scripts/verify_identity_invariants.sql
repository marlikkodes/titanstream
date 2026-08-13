-- =============================================================================
-- TITAN STREAM IDENTITY MASTER ENGINE — EXECUTABLE SQL INVARIANT SUITE
-- =============================================================================
-- Execute this script against PostgreSQL database to prove 100% identity invariants.

BEGIN;

-- 1. UniversalIdentity.id === User.id for 100% of User records
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS: UniversalIdentity.id === User.id for 100% of users'
    ELSE 'FAIL: Found ' || COUNT(*) || ' mismatched User/UniversalIdentity IDs'
  END AS invariant_1_identity_user_alignment
FROM users u
LEFT JOIN universal_identities ui ON ui.id = u.id
WHERE ui.id IS NULL OR u.identity_id != ui.id;

-- 2. Zero Users without UniversalIdentity
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS: Zero Users without UniversalIdentity'
    ELSE 'FAIL: Found ' || COUNT(*) || ' orphan users'
  END AS invariant_2_zero_orphan_users
FROM users u
LEFT JOIN universal_identities ui ON ui.id = u.identity_id
WHERE ui.id IS NULL;

-- 3. Zero Duplicate Channel Identies (provider + identifier composite uniqueness)
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS: Composite uniqueness enforced on (provider, identifier)'
    ELSE 'FAIL: Found ' || COUNT(*) || ' duplicate channel identities'
  END AS invariant_3_channel_uniqueness
FROM (
  SELECT provider, identifier, COUNT(*) 
  FROM channel_identities 
  GROUP BY provider, identifier 
  HAVING COUNT(*) > 1
) dupes;

-- 4. Zero Orphan Financial Accounts
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS: Zero Orphan Financial Accounts'
    ELSE 'FAIL: Found ' || COUNT(*) || ' financial accounts missing canonical User'
  END AS invariant_4_financial_account_user_link
FROM financial_accounts fa
LEFT JOIN users u ON u.id = fa.user_id OR u.telegram_user_id = fa.telegram_user_id
WHERE u.id IS NULL;

COMMIT;
