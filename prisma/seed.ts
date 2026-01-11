/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import * as bcrypt from 'bcrypt';
import { PrismaClient, UserRole } from '../src/generated/prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? 'Admin';

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL y ADMIN_PASSWORD son obligatorios');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Idempotente: si ya existe por email, no duplica
  await prisma.user.upsert({
    where: { email },
    update: {
      // opcional: si quieres actualizar datos cuando ya existe
      name,
      role: UserRole.ADMIN,
      isActive: true,
      // Si NO quieres reescribir password en cada deploy, comenta la siguiente línea
      // password: passwordHash,
    },
    create: {
      name,
      email,
      password: passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  console.log(`✅ Seed OK: admin asegurado (${email})`);
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
