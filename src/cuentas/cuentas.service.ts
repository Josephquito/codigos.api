import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCuentaDto } from './dto/create-cuenta.dto';
import { UpdateCuentaDto } from './dto/update-cuenta.dto';

@Injectable()
export class CuentasService {
  constructor(private readonly prisma: PrismaService) {}

  private norm(v: string) {
    return v.trim().toLowerCase();
  }

  private parseDateOrThrow(v: string): Date {
    const d = new Date(v);
    if (Number.isNaN(d.getTime()))
      throw new BadRequestException('Fecha inválida');
    return d;
  }

  /** Regla default: si no envían fecha, programo cambio en 30 días */
  private defaultPasswordChangeAt() {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d;
  }

  /** Lista filas independientes (lo que tu UI necesita) */
  findAll(userId: number) {
    return this.prisma.platformAccessKey.findMany({
      where: { userId, active: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        emailAlias: true,
        plataforma: true,
        clave: true,
        createdAt: true,
        passwordChangeAt: true,
      },
    });
  }

  /** Crear fila (correo+plataforma independiente) */
  async create(userId: number, dto: CreateCuentaDto) {
    const emailAlias = this.norm(dto.emailAlias);
    const plataforma = this.norm(dto.plataforma);

    const passwordChangeAt = dto.passwordChangeAt
      ? this.parseDateOrThrow(dto.passwordChangeAt)
      : this.defaultPasswordChangeAt();

    try {
      return await this.prisma.platformAccessKey.create({
        data: {
          userId,
          emailAlias,
          plataforma,
          clave: dto.clave,
          active: true,
          passwordChangeAt,
        },
        select: {
          id: true,
          emailAlias: true,
          plataforma: true,
          clave: true,
          createdAt: true,
          passwordChangeAt: true,
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException(
          'Ya existe esa plataforma para ese correo en este usuario',
        );
      }
      throw e;
    }
  }

  /**
   * Update por id (mucho más simple para CRUD por fila)
   * - Si actualizas clave, normalmente reprogramas passwordChangeAt
   *   a +30 días, a menos que el frontend envíe una fecha explícita.
   */
  async update(userId: number, id: number, dto: UpdateCuentaDto) {
    const existing = await this.prisma.platformAccessKey.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Registro no encontrado');

    const data: any = {};

    if (typeof dto.clave === 'string') {
      const c = dto.clave;
      if (!c.trim()) throw new BadRequestException('Clave inválida');
      data.clave = c;

      // si no envían fecha, la reprogramo por default
      data.passwordChangeAt = dto.passwordChangeAt
        ? this.parseDateOrThrow(dto.passwordChangeAt)
        : this.defaultPasswordChangeAt();
    } else if (typeof dto.passwordChangeAt === 'string') {
      // si solo reprograman fecha (sin cambiar clave)
      data.passwordChangeAt = this.parseDateOrThrow(dto.passwordChangeAt);
    }

    return this.prisma.platformAccessKey.update({
      where: { id },
      data,
      select: {
        id: true,
        emailAlias: true,
        plataforma: true,
        clave: true,
        createdAt: true,
        passwordChangeAt: true,
      },
    });
  }

  /** Delete por id */
  async remove(userId: number, id: number) {
    const existing = await this.prisma.platformAccessKey.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Registro no encontrado');

    await this.prisma.platformAccessKey.delete({ where: { id } });
    return { deleted: true, id };
  }
}
