// cuentas/cuentas.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCuentaDto } from './dto/create-cuenta.dto';
import { UpdateCuentaDto } from './dto/update-cuenta.dto';

type CuentaRow = {
  correo: string;
  disney: string;
  netflix: string;
  prime: string;
  chatgpt: string;
  crunchyroll: string;
};

function baseCuenta(correo: string): CuentaRow {
  return {
    correo,
    disney: 'Sin asignar',
    netflix: 'Sin asignar',
    prime: 'Sin asignar',
    chatgpt: 'Sin asignar',
    crunchyroll: 'Sin asignar',
  };
}

@Injectable()
export class CuentasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: number) {
    const registros = await this.prisma.platformAccessKey.findMany({
      where: { userId, active: true },
      select: { emailAlias: true, plataforma: true, clave: true },
      orderBy: [{ emailAlias: 'asc' }],
    });

    const cuentasMap = new Map<string, CuentaRow>();

    for (const reg of registros) {
      const correo = reg.emailAlias.toLowerCase();
      const plataforma = reg.plataforma.toLowerCase();

      if (!cuentasMap.has(correo)) {
        cuentasMap.set(correo, baseCuenta(correo));
      }

      const cuenta = cuentasMap.get(correo)!;

      // Solo setea si la plataforma coincide con una propiedad
      if (plataforma in cuenta) {
        (cuenta as any)[plataforma] = reg.clave;
      }
    }

    return Array.from(cuentasMap.values());
  }

  async findByEmail(userId: number, email: string) {
    const emailAlias = email.toLowerCase();

    const registros = await this.prisma.platformAccessKey.findMany({
      where: { userId, emailAlias, active: true },
      select: { plataforma: true, clave: true },
    });

    if (registros.length === 0) return [];

    const cuenta = baseCuenta(emailAlias);

    for (const reg of registros) {
      const plataforma = reg.plataforma.toLowerCase();
      if (plataforma in cuenta) {
        (cuenta as any)[plataforma] = reg.clave;
      }
    }

    return [cuenta];
  }

  async create(userId: number, dto: CreateCuentaDto) {
    return this.prisma.platformAccessKey.create({
      data: {
        userId,
        emailAlias: dto.emailAlias.toLowerCase(),
        plataforma: dto.plataforma.toLowerCase(),
        clave: dto.clave,
        active: true,
      },
    });
  }

  async update(
    userId: number,
    emailAlias: string,
    plataforma: string,
    dto: UpdateCuentaDto,
  ) {
    return this.prisma.platformAccessKey.update({
      where: {
        userId_plataforma_emailAlias: {
          userId,
          plataforma: plataforma.toLowerCase(),
          emailAlias: emailAlias.toLowerCase(),
        },
      },
      data: {
        clave: dto.clave,
      },
    });
  }

  async remove(userId: number, emailAlias: string, plataforma: string) {
    await this.prisma.platformAccessKey.delete({
      where: {
        userId_plataforma_emailAlias: {
          userId,
          plataforma: plataforma.toLowerCase(),
          emailAlias: emailAlias.toLowerCase(),
        },
      },
    });

    return true;
  }

  async eliminarCuentaCompleta(userId: number, emailAlias: string) {
    const res = await this.prisma.platformAccessKey.deleteMany({
      where: {
        userId,
        emailAlias: emailAlias.toLowerCase(),
      },
    });

    return res.count > 0;
  }
}
