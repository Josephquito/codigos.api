/*
  Warnings:

  - A unique constraint covering the columns `[plataforma,email_alias,clave]` on the table `platform_access_keys` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "platform_access_keys_plataforma_email_alias_clave_key" ON "platform_access_keys"("plataforma", "email_alias", "clave");
