import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { CuentasService } from './cuentas.service';
import { CreateCuentaDto } from './dto/create-cuenta.dto';
import { UpdateCuentaDto } from './dto/update-cuenta.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../generated/prisma/client';

@Controller('cuentas')
@UseGuards(JwtAuthGuard)
export class CuentasController {
  constructor(private readonly cuentasService: CuentasService) {}

  private assertUserOrAdmin(role: UserRole) {
    if (role !== UserRole.USER && role !== UserRole.ADMIN) {
      throw new ForbiddenException('No autorizado');
    }
  }

  // =========================
  // Keys (USER + ADMIN)
  // =========================

  /**
   * Listar mis claves (USER + ADMIN)
   */
  @Get('keys')
  async listMyKeys(@Req() req: any) {
    this.assertUserOrAdmin(req.user.role);
    return this.cuentasService.findAll(req.user.id);
  }

  /**
   * Buscar mis claves por email alias (USER + ADMIN)
   * /cuentas/keys/search?email=correo@dominio.com
   */
  @Get('keys/search')
  async findMyKeysByEmail(@Req() req: any, @Query('email') email: string) {
    this.assertUserOrAdmin(req.user.role);
    return this.cuentasService.findByEmail(req.user.id, email);
  }

  /**
   * Crear clave (USER + ADMIN)
   * Body: { emailAlias, plataforma, clave }
   */
  @Post('keys')
  async createKey(@Req() req: any, @Body() dto: CreateCuentaDto) {
    this.assertUserOrAdmin(req.user.role);
    return this.cuentasService.create(req.user.id, dto);
  }

  /**
   * Actualizar clave (USER + ADMIN)
   * PATCH /cuentas/keys/:emailAlias/:plataforma
   * Body: { clave }
   */
  @Patch('keys/:emailAlias/:plataforma')
  async updateKey(
    @Req() req: any,
    @Param('emailAlias') emailAlias: string,
    @Param('plataforma') plataforma: string,
    @Body() dto: UpdateCuentaDto,
  ) {
    this.assertUserOrAdmin(req.user.role);
    return this.cuentasService.update(req.user.id, emailAlias, plataforma, dto);
  }

  /**
   * Eliminar clave puntual (USER + ADMIN)
   * DELETE /cuentas/keys/:emailAlias/:plataforma
   */
  @Delete('keys/:emailAlias/:plataforma')
  async deleteKey(
    @Req() req: any,
    @Param('emailAlias') emailAlias: string,
    @Param('plataforma') plataforma: string,
  ) {
    this.assertUserOrAdmin(req.user.role);
    return this.cuentasService.remove(req.user.id, emailAlias, plataforma);
  }

  /**
   * Eliminar todas mis claves de un alias (USER + ADMIN)
   * DELETE /cuentas/keys/:emailAlias
   */
  @Delete('keys/:emailAlias')
  async deleteAllKeysForAlias(
    @Req() req: any,
    @Param('emailAlias') emailAlias: string,
  ) {
    this.assertUserOrAdmin(req.user.role);
    return this.cuentasService.eliminarCuentaCompleta(req.user.id, emailAlias);
  }
}
