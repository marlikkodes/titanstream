-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_identity_id_fkey";

ALTER TABLE "users" ALTER COLUMN "identity_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_identity_id_key" ON "users"("identity_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "universal_identities"("identity_id") ON DELETE RESTRICT ON UPDATE CASCADE;
