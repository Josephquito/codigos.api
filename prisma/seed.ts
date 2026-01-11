/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '../src/generated/prisma/client';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`${name} es obligatorio`);
  return v;
}

const DATABASE_URL = requireEnv('DATABASE_URL');

const pool = new Pool({
  connectionString: DATABASE_URL,
  // Importante: en Render “internal” normalmente no requiere ssl.
  // Si usas External Database URL desde fuera, normalmente sí requiere sslmode=require en la URL.
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

async function main() {
  const email = requireEnv('ADMIN_EMAIL');
  const password = requireEnv('ADMIN_PASSWORD');
  const name = process.env.ADMIN_NAME ?? 'Admin';

  const passwordHash = await bcrypt.hash(password, 10);

  // Idempotente
  await prisma.user.upsert({
    where: { email },
    update: {
      name,
      role: UserRole.ADMIN,
      isActive: true,
      // Si NO quieres que cambie la clave en cada deploy, deja esto comentado:
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
    await pool.end();
  });
