import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  JwtPayload,
  AuthRequest,
  AuthUser,
} from '../types/auth-request.interface';
import { TokenExpiredError } from 'jsonwebtoken';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // ✅ obtén el request ya TIPADO
    const req = context.switchToHttp().getRequest<AuthRequest>();

    const token = this.extractTokenFromHeader(req as unknown as Request);
    if (!token) {
      throw new UnauthorizedException('Token no proporcionado');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET')!,
        clockTolerance: 5,
        // ignoreExpiration: false // por defecto es false
      });

      // ✅ normaliza: siempre tendrás req.user.id / .email / .role
      const user: AuthUser = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      req.user = user;

      return true;
    } catch (err: unknown) {
      if (err instanceof TokenExpiredError) {
        throw new UnauthorizedException('Token expirado');
      }
      throw new UnauthorizedException('Token inválido');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
