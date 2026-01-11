import {
  Body,
  Controller,
  Delete,
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

  // =========================
  // Keys (USER)
  // =========================

  /**
   * Listar mis claves (USER)
   */
  @Get('keys')
  async listMyKeys(@Req() req: any) {
    if (req.user.role !== UserRole.USER) {
      throw new Error('Solo USER puede gestionar claves');
    }
    return this.cuentasService.findAll(req.user.id);
  }

  /**
   * Buscar mis claves por email alias (USER)
   * /cuentas/keys/search?email=correo@dominio.com
   */
  @Get('keys/search')
  async findMyKeysByEmail(@Req() req: any, @Query('email') email: string) {
    if (req.user.role !== UserRole.USER) {
      throw new Error('Solo USER puede gestionar claves');
    }
    return this.cuentasService.findByEmail(req.user.id, email);
  }

  /**
   * Crear clave (USER)
   * Body: { emailAlias, plataforma, clave }
   */
  @Post('keys')
  async createKey(@Req() req: any, @Body() dto: CreateCuentaDto) {
    if (req.user.role !== UserRole.USER) {
      throw new Error('Solo USER puede gestionar claves');
    }
    return this.cuentasService.create(req.user.id, dto);
  }

  /**
   * Actualizar clave (USER)
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
    if (req.user.role !== UserRole.USER) {
      throw new Error('Solo USER puede gestionar claves');
    }
    return this.cuentasService.update(req.user.id, emailAlias, plataforma, dto);
  }

  /**
   * Eliminar clave puntual (USER)
   * DELETE /cuentas/keys/:emailAlias/:plataforma
   */
  @Delete('keys/:emailAlias/:plataforma')
  async deleteKey(
    @Req() req: any,
    @Param('emailAlias') emailAlias: string,
    @Param('plataforma') plataforma: string,
  ) {
    if (req.user.role !== UserRole.USER) {
      throw new Error('Solo USER puede gestionar claves');
    }
    return this.cuentasService.remove(req.user.id, emailAlias, plataforma);
  }

  /**
   * Eliminar todas mis claves de un alias (USER)
   * DELETE /cuentas/keys/:emailAlias
   */
  @Delete('keys/:emailAlias')
  async deleteAllKeysForAlias(
    @Req() req: any,
    @Param('emailAlias') emailAlias: string,
  ) {
    if (req.user.role !== UserRole.USER) {
      throw new Error('Solo USER puede gestionar claves');
    }
    return this.cuentasService.eliminarCuentaCompleta(req.user.id, emailAlias);
  }
}
