import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { ImapModule } from './imap/imap.module';
import { GmailModule } from './gmail/gmail.module';
import { CorreoModule } from './correo/correo.module';
import { CuentasModule } from './cuentas/cuentas.module';
import { PlataformasModule } from './plataformas/plataformas.module';

@Module({
  imports: [
    // 🌍 Variables de entorno globales
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    PrismaModule,

    // 🔐 Auth & Users
    AuthModule,
    UsersModule,

    // 📧 Email modules
    GmailModule,
    ImapModule,
    CorreoModule,
    CuentasModule,
    PlataformasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
