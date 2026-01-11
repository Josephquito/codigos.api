/*
  Warnings:

  - Added the required column `imap_host` to the `imap_accounts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "imap_accounts" ADD COLUMN     "imap_host" TEXT NOT NULL,
ADD COLUMN     "imap_port" INTEGER NOT NULL DEFAULT 993,
ADD COLUMN     "is_catch_all" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "use_tls" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "imap_accounts_user_id_is_catch_all_idx" ON "imap_accounts"("user_id", "is_catch_all");
