import { Request } from 'express';

export interface JwtPayload {
  id: number;
  email: string;
  role: string;
}

export interface AuthRequest extends Request {
  user: JwtPayload;
}
