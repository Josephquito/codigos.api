import { Module } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { GmailController } from './gmail.controller';
import { GmailAuthModule } from '../gmail-auth/gmail-auth.module'; // 👈 importar el módulo

@Module({
  imports: [GmailAuthModule], // 👈 esto es lo que le dice a Nest cómo resolver AuthService
  controllers: [GmailController],
  providers: [GmailService],
})
export class GmailModule {}
