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
import { PlatformAccessKey } from './correo/entities/platform-access-key.entity';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';
import { User } from './users/entities/user.entity';
import { GmailController } from './gmail/gmail.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
      entities: [GmailToken, PlatformAccessKey, User],
      synchronize: false, // desactiva esto en producción
    }),
    TypeOrmModule.forFeature([GmailToken]),
    GmailModule,
    ImapModule,
    ImapAccountModule,
    CorreoModule,
    CuentasModule,
    GmailAuthModule,
    AuthModule,
    UsersModule,
    GmailController,
  ],
  controllers: [AppController],
  providers: [AppService, GmailTokenService],
  exports: [GmailTokenService],
})
export class AppModule {}
