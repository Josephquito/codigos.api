import { Controller, Get, Query, Post, Body, Put, Param } from '@nestjs/common';
import { CuentasService } from './cuentas.service';
import { CreateCuentaDto } from './dto/create-cuenta.dto';
import { UpdateCuentaDto } from './dto/update-cuenta.dto';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guard/auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user-role.enum';
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('cuentas')
export class CuentasController {
  constructor(private readonly cuentasService: CuentasService) {}

  @Get()
  findAll() {
    return this.cuentasService.findAll();
  }

  @Get('buscar')
  findByEmail(@Query('email') email: string) {
    return this.cuentasService.findByEmail(email);
  }

  @Post()
  create(@Body() dto: CreateCuentaDto) {
    return this.cuentasService.create(dto);
  }

  @Put(':emailAlias/:plataforma')
  update(
    @Param('emailAlias') emailAlias: string,
    @Param('plataforma') plataforma: string,
    @Body() dto: UpdateCuentaDto,
  ) {
    return this.cuentasService.update(emailAlias, plataforma, dto);
  }
}
