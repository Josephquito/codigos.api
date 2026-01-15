/*
  Warnings:

  - You are about to drop the `platform_access_keys` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "platform_access_keys" DROP CONSTRAINT "platform_access_keys_user_id_fkey";

-- DropTable
DROP TABLE "platform_access_keys";

-- CreateTable
CREATE TABLE "PlatformAccessKey" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "emailAlias" TEXT NOT NULL,
    "plataforma" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "passwordChangeAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAccessKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformAccessKey_userId_idx" ON "PlatformAccessKey"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformAccessKey_plataforma_emailAlias_clave_key" ON "PlatformAccessKey"("plataforma", "emailAlias", "clave");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformAccessKey_userId_plataforma_emailAlias_key" ON "PlatformAccessKey"("userId", "plataforma", "emailAlias");

-- AddForeignKey
ALTER TABLE "PlatformAccessKey" ADD CONSTRAINT "PlatformAccessKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
