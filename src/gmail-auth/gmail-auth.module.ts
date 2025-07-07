// src/gmail-auth/gmail-auth.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GmailAuthService } from './gmail-auth.service'; // Renombrado
import { GmailToken } from '../gmail/entities/gmail-token.entity';
import { PlataformaClaveService } from '../plataformas/plataforma-clave.service';
import { PlatformAccessKey } from 'src/correo/entities/platform-access-key.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GmailToken, PlatformAccessKey])],
  providers: [GmailAuthService, PlataformaClaveService],
  exports: [GmailAuthService, PlataformaClaveService],
})
export class GmailAuthModule {}
