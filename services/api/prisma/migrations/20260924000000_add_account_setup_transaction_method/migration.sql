-- Account Setup personalization: canonical preferred transaction method (nullable
-- so existing rows stay valid; NULL means "not yet chosen" -> setup incomplete).
-- No backfill inference: existing phone/USDT data must NOT imply a preference.

-- CreateEnum
CREATE TYPE "TransactionMethod" AS ENUM ('MOBILE_MONEY', 'CRYPTO');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "preferred_transaction_method" "TransactionMethod";

-- AlterEnum (append-only, no rewrite of existing rows)
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ACCOUNT_SETUP_COMPLETED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'TRANSACTION_METHOD_CHANGED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'WITHDRAWAL_PHONE_CHANGED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'PROFILE_NAME_UPDATED';
