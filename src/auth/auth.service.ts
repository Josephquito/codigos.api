import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';

import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../users/user-role.enum'; // ajusta la ruta si es diferente

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}
  async register({ name, email, password, role }: RegisterDto) {
    const user = await this.usersService.findOneByEmail(email);
    if (user) {
      throw new BadRequestException('User already exists');
    }
    return this.usersService.create({
      name,
      email,
      password: await bcrypt.hash(password, 10),
      role: role ?? UserRole.USER,
    });
  }

  async login({ email, password }: LoginDto) {
    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Email no es correcto');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Contraseña no es correcta');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role, // 👈 importante incluir esto
    };

    const token = await this.jwtService.signAsync(payload);

    return {
      token,
      email: user.email,
      role: user.role, // 👈 ahora sí se devuelve
    };
  }
}
