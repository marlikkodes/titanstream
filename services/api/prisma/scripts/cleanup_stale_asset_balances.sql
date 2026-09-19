-- AssetBalance Cleanup Script
-- This script addresses the stale AssetBalance table that was not synchronized with the authoritative ledger
-- 
-- PROBLEM: AssetBalance table contains stale data (e.g., 150.0 USDT) while ledger shows correct balance (3.0 USDT)
-- SOLUTION: Sync AssetBalance with ledger for immediate fix
--
-- DEPRECATION NOTICE: AssetBalance table is being phased out in favor of authoritative ledger calculations
-- All balance queries should use BalanceService.getBalances() which calculates from ledger entries

-- Sync AssetBalance with authoritative ledger data
BEGIN;

-- Update existing AssetBalance records with correct ledger values
UPDATE asset_balances ab
SET 
    available_balance = lbs.calculated_balance,
    updated_at = NOW()
FROM (
    SELECT 
        fa.telegram_user_id,
        fa.user_id,
        le.asset_code,
        SUM(CASE 
            WHEN le.entry_type = 'CREDIT' THEN le.amount 
            ELSE -le.amount 
        END) as calculated_balance
    FROM financial_accounts fa
    JOIN ledger_entries le ON fa.financial_account_id = le.financial_account_id
    JOIN ledger_accounts la ON le.ledger_account_id = la.ledger_account_id
    WHERE la.code = 'USER_ASSET_LIABILITY'
    GROUP BY fa.telegram_user_id, fa.user_id, le.asset_code
) lbs
WHERE ab.telegram_user_id = lbs.telegram_user_id 
  AND ab.asset = lbs.asset_code;

COMMIT;

-- Verify the sync results
SELECT 'AssetBalance Sync Verification' as operation,
       ab.telegram_user_id,
       ab.asset,
       ab.available_balance as asset_balance,
       le.ledger_balance as ledger_balance,
       CASE WHEN ab.available_balance = le.ledger_balance THEN 'SYNCED' ELSE 'MISMATCH' END as status
FROM asset_balances ab
LEFT JOIN (
    SELECT 
        fa.telegram_user_id,
        le.asset_code,
        SUM(CASE 
            WHEN le.entry_type = 'CREDIT' THEN le.amount 
            ELSE -le.amount 
        END) as ledger_balance
    FROM financial_accounts fa
    JOIN ledger_entries le ON fa.financial_account_id = le.financial_account_id
    JOIN ledger_accounts la ON le.ledger_account_id = la.ledger_account_id
    WHERE la.code = 'USER_ASSET_LIABILITY'
    GROUP BY fa.telegram_user_id, le.asset_code
) le ON ab.telegram_user_id = le.telegram_user_id AND ab.asset = le.asset_code
ORDER BY ab.telegram_user_id, ab.asset;