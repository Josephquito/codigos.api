// src/users/users.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../generated/prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // 👤 Usuario autenticado
  @Get('me')
  getMe(@Req() req: any) {
    return this.usersService.findById(req.user.id);
  }

  // ➕ Crear usuario (ADMIN)
  @Post()
  create(@Body() dto: CreateUserDto, @Req() req: any) {
    if (req.user.role !== UserRole.ADMIN) {
      throw new Error('Solo ADMIN puede crear usuarios');
    }
    return this.usersService.createUser(dto);
  }

  @Get()
  list(@Req() req: any) {
    if (req.user.role !== UserRole.ADMIN) {
      throw new Error('Solo ADMIN puede listar usuarios');
    }
    return this.usersService.listAllUsers();
  }

  // 🚫 Activar / desactivar usuario (ADMIN)
  @Patch(':id/active')
  setActive(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { isActive: boolean },
    @Req() req: any,
  ) {
    if (req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo ADMIN puede modificar usuarios');
    }

    // ✅ Evita auto-desactivación
    if (req.user.id === id && body.isActive === false) {
      throw new ForbiddenException('No puedes desactivarte a ti mismo');
    }

    return this.usersService.setActive(id, body.isActive);
  }
}
