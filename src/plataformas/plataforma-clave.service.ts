// plataformas/plataforma-clave.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlataformaClaveService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validación pública: resuelve el owner (userId) a partir del triple único.
   * NO requiere JWT.
   */
  async validarPublico(
    email: string,
    plataforma: string,
    clave: string,
  ): Promise<
    | { ok: true; userId: number; emailAlias: string; plataforma: string }
    | { ok: false }
  > {
    const emailAlias = email.toLowerCase();
    const plat = plataforma.toLowerCase();

    const row = await this.prisma.platformAccessKey.findUnique({
      where: {
        plataforma_emailAlias_clave: {
          plataforma: plat,
          emailAlias,
          clave,
        },
      },
      select: {
        userId: true,
        active: true,
        emailAlias: true,
        plataforma: true,
      },
    });

    if (!row || !row.active) return { ok: false };
    return {
      ok: true,
      userId: row.userId,
      emailAlias: row.emailAlias,
      plataforma: row.plataforma,
    };
  }

  /**
   * Validación privada: útil para panel/gestión; compara clave dentro del tenant.
   */
  async validarPrivado(
    userId: number,
    email: string,
    plataforma: string,
    clave: string,
  ): Promise<boolean> {
    const emailAlias = email.toLowerCase();
    const plat = plataforma.toLowerCase();

    const row = await this.prisma.platformAccessKey.findUnique({
      where: {
        userId_plataforma_emailAlias: {
          userId,
          plataforma: plat,
          emailAlias,
        },
      },
      select: { clave: true, active: true },
    });

    return !!row && row.active && row.clave === clave;
  }
}
