-- AssetBalance Sync with Authoritative Ledger
-- This script syncs AssetBalance table with the correct ledger values
-- After this sync, AssetBalance will match the authoritative ledger data

BEGIN;

-- Update AssetBalance to match authoritative ledger data
UPDATE asset_balances ab
SET 
    available_balance = ledger_data.calculated_balance,
    updated_at = NOW()
FROM (
    SELECT 
        fa.telegram_user_id,
        le.asset_code,
        SUM(CASE 
            WHEN le.entry_type = 'CREDIT' THEN le.amount 
            ELSE -le.amount 
        END) as calculated_balance
    FROM financial_accounts fa
    JOIN ledger_entries le ON fa.financial_account_id = le.financial_account_id
    JOIN ledger_accounts la ON le.ledger_account_id = la.ledger_account_id
    WHERE la.code = 'USER_ASSET_LIABILITY'
    GROUP BY fa.telegram_user_id, le.asset_code
) ledger_data
WHERE ab.telegram_user_id = ledger_data.telegram_user_id 
  AND ab.asset = ledger_data.asset_code;

COMMIT;

-- Verify the sync results
SELECT 'AssetBalance Sync Verification' as operation,
       ab.telegram_user_id,
       ab.asset,
       ab.available_balance as asset_balance,
       ledger_data.ledger_balance,
       CASE WHEN ab.available_balance = ledger_data.ledger_balance THEN 'SYNCED' ELSE 'MISMATCH' END as status
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
) ledger_data ON ab.telegram_user_id = ledger_data.telegram_user_id AND ab.asset = ledger_data.asset_code
ORDER BY ab.telegram_user_id, ab.asset;