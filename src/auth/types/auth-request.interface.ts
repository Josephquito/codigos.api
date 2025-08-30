import { Request } from 'express';

export interface JwtPayload {
  sub: number | string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  id: number | string;
  email: string;
  role: string;
}

export interface AuthRequest extends Request {
  user: AuthUser;
}
