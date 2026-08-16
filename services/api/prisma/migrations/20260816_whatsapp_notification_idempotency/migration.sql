-- AlterTable: Add whatsapp_enabled column to notification_preferences
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "whatsapp_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: Add idempotency_key column to notifications
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;

-- CreateIndex: Add unique constraint on idempotency_key
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_idempotency_key_key" ON "notifications"("idempotency_key");
