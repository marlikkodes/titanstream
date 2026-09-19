ALTER TYPE "FinancialOperationType" ADD VALUE IF NOT EXISTS 'DEPOSIT_SETTLEMENT';

CREATE UNIQUE INDEX IF NOT EXISTS "settlement_sessions_orchestrator_reference_key"
  ON "settlement_sessions"("orchestrator_reference");

ALTER TABLE "user_machines" ADD COLUMN IF NOT EXISTS "purchase_reference" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "user_machines_purchase_reference_key"
  ON "user_machines"("purchase_reference");
