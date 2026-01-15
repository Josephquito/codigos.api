/*
  Warnings:

  - Added the required column `password_change_at` to the `platform_access_keys` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "platform_access_keys_plataforma_email_alias_clave_key";

-- AlterTable
ALTER TABLE "platform_access_keys" ADD COLUMN     "password_change_at" TIMESTAMP(3) NOT NULL;
