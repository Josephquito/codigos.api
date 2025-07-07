// src/app.module.ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GmailModule } from './gmail/gmail.module';
import { GmailAuthModule } from './gmail-auth/gmail-auth.module';
import { ImapModule } from './imap/imap.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GmailToken } from './gmail/entities/gmail-token.entity';
import { GmailTokenService } from './gmail/gmail-token.service';
import { ImapAccountModule } from './imap-account/imap-account.module';
import { CorreoModule } from './correo/correo.module';
import { CuentasModule } from './cuentas/cuentas.module';
import * as dotenv from 'dotenv';
import { PlatformAccessKey } from './correo/entities/platform-access-key.entity';
dotenv.config();
console.log('DB_PASS', process.env.DB_PASS, typeof process.env.DB_PASS);
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      ssl: true, // 👈 Obligatorio para Render
      extra: {
        ssl: {
          rejectUnauthorized: false, // 👈 Evita errores con certificados autofirmados
        },
      },
      autoLoadEntities: true,
      entities: [GmailToken, PlatformAccessKey],
      synchronize: false, // desactiva esto en producción
    }),
    TypeOrmModule.forFeature([GmailToken]),
    GmailModule,
    ImapModule,
    ImapAccountModule,
    CorreoModule,
    CuentasModule,
    GmailAuthModule,
  ],
  controllers: [AppController],
  providers: [AppService, GmailTokenService],
  exports: [GmailTokenService],
})
export class AppModule {}
