import { Module } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { GmailController } from './gmail.controller';
import { AuthModule } from '../auth/auth.module'; // 👈 importar el módulo

@Module({
  imports: [AuthModule], // 👈 esto es lo que le dice a Nest cómo resolver AuthService
  controllers: [GmailController],
  providers: [GmailService],
})
export class GmailModule {}
