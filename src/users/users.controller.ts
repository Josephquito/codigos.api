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

  // 🚫 Activar / desactivar usuario (ADMIN)
  @Patch(':id/active')
  setActive(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
    @Req() req: any,
  ) {
    if (req.user.role !== UserRole.ADMIN) {
      throw new Error('Solo ADMIN puede modificar usuarios');
    }
    return this.usersService.setActive(Number(id), body.isActive);
  }
}
