// src/users/users.service.ts
import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../generated/prisma/client';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================
  // Helpers
  // =========================
  private normEmail(v: string): string {
    return (v || '').trim().toLowerCase();
  }

  private normName(v: string): string {
    return (v || '').trim();
  }

  // =========================
  // 🔐 Crear usuario (ADMIN)
  // =========================
  async createUser(input: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
  }) {
    const name = this.normName(input.name);
    const email = this.normEmail(input.email);
    const password = (input.password || '').trim();

    if (!name) throw new BadRequestException('Nombre inválido');
    if (!email) throw new BadRequestException('Email inválido');
    if (!password || password.length < 6)
      throw new BadRequestException('Password mínimo 6 caracteres');

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      return await this.prisma.user.create({
        data: {
          name,
          email,
          password: passwordHash,
          role: input.role ?? UserRole.USER,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('El email ya está registrado');
      }
      throw error;
    }
  }

  // =========================
  // 🔍 Uso interno (Auth)
  // =========================
  async findOneByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: this.normEmail(email) },
    });
  }

  // =========================
  // 👤 Usuario autenticado
  // =========================
  async findById(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  // =========================
  // 👥 Listar usuarios (ADMIN)
  // =========================
  async listAllUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // =========================
  // 🚫 Activar / desactivar (ADMIN)
  // =========================
  async setActive(userId: number, isActive: boolean) {
    // (opcional) validar existencia para error más claro
    const exists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Usuario no encontrado');

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // =========================
  // ✏️ Editar usuario completo (ADMIN)
  // =========================
  async updateUserByAdmin(userId: number, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });
    if (!existing) throw new NotFoundException('Usuario no encontrado');

    const data: Record<string, any> = {};

    // name
    if (typeof dto.name === 'string') {
      const name = this.normName(dto.name);
      if (!name) throw new BadRequestException('Nombre inválido');
      data.name = name;
    }

    // email
    if (typeof dto.email === 'string') {
      const email = this.normEmail(dto.email);
      if (!email) throw new BadRequestException('Email inválido');
      data.email = email;
    }

    // role
    if (typeof dto.role !== 'undefined') {
      data.role = dto.role;
    }

    // isActive
    if (typeof dto.isActive === 'boolean') {
      data.isActive = dto.isActive;
    }

    // password
    if (typeof dto.password === 'string') {
      const pass = (dto.password || '').trim();
      if (!pass || pass.length < 6) {
        throw new BadRequestException('Password mínimo 6 caracteres');
      }
      data.password = await bcrypt.hash(pass, 10);
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No hay campos para actualizar');
    }

    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('El email ya está registrado');
      }
      throw error;
    }
  }
}
