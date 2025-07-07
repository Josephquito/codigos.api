// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { GmailToken } from '../gmail/entities/gmail-token.entity';
import { PlataformaClaveService } from './plataforma-clave.service';
import { PlatformAccessKey } from 'src/correo/entities/platform-access-key.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GmailToken, PlatformAccessKey])],
  providers: [AuthService, PlataformaClaveService],
  exports: [AuthService, PlataformaClaveService],
})
export class AuthModule {}
