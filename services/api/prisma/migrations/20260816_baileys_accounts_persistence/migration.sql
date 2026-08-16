-- CreateTable
CREATE TABLE "baileys_accounts" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "auth_folder" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "health_state" TEXT NOT NULL DEFAULT 'HEALTHY',
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_quarantined" BOOLEAN NOT NULL DEFAULT false,
    "pairing_code" TEXT,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "last_connected_at" TIMESTAMP(3),
    "last_message_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "baileys_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "baileys_accounts_account_id_key" ON "baileys_accounts"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "baileys_accounts_phone_key" ON "baileys_accounts"("phone");
