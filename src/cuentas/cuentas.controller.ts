import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../generated/prisma/client';

import { CuentasService } from './cuentas.service';
import { CreateCuentaDto } from './dto/create-cuenta.dto';
import { UpdateCuentaDto } from './dto/update-cuenta.dto';

@Controller('cuentas')
@UseGuards(JwtAuthGuard)
export class CuentasController {
  constructor(private readonly cuentas: CuentasService) {}

  private assertUserOrAdmin(role: UserRole) {
    if (role !== UserRole.USER && role !== UserRole.ADMIN) {
      throw new ForbiddenException('No autorizado');
    }
  }

  // =========================
  // CRUD (fila independiente)
  // =========================

  /**
   * GET /cuentas
   * Lista todas las cuentas del usuario (fila por cuenta)
   *
   * Opcional:
   *  - /cuentas?email=correo@dominio.com
   *  - /cuentas?platform=netflix
   *  - /cuentas?email=...&platform=...
   *
   * Si no quieres filtros aquí, puedes quitarlos y filtrar en el frontend.
   */
  @Get()
  async list(
    @Req() req: any,
    @Query('email') email?: string,
    @Query('platform') platform?: string,
  ) {
    this.assertUserOrAdmin(req.user.role);

    const rows = await this.cuentas.findAll(req.user.id);

    // Filtros simples en controller (opcionales)
    const qEmail = (email || '').trim().toLowerCase();
    const qPlatform = (platform || '').trim().toLowerCase();

    return rows.filter((r: any) => {
      const okEmail = qEmail
        ? (r.emailAlias || '').toLowerCase() === qEmail
        : true;
      const okPlatform = qPlatform
        ? (r.plataforma || '').toLowerCase() === qPlatform
        : true;
      return okEmail && okPlatform;
    });
  }

  /**
   * POST /cuentas
   * Crea una fila: { emailAlias, plataforma, clave, passwordChangeAt? }
   */
  @Post()
  create(@Req() req: any, @Body() dto: CreateCuentaDto) {
    this.assertUserOrAdmin(req.user.role);
    return this.cuentas.create(req.user.id, dto);
  }

  /**
   * PATCH /cuentas/:id
   * Edita una fila por id:
   *  - { clave? , passwordChangeAt? }
   */
  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCuentaDto,
  ) {
    this.assertUserOrAdmin(req.user.role);
    return this.cuentas.update(req.user.id, id, dto);
  }

  /**
   * DELETE /cuentas/:id
   * Elimina una fila por id
   */
  @Delete(':id')
  remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    this.assertUserOrAdmin(req.user.role);
    return this.cuentas.remove(req.user.id, id);
  }
}
