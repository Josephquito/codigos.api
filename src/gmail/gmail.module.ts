// gmail.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GmailToken } from './entities/gmail-token.entity'; // Asegúrate de que esta es la entidad correcta
import { GmailService } from './gmail.service';
import { GmailAuthService } from '../gmail-auth/gmail-auth.service';

@Module({
  imports: [TypeOrmModule.forFeature([GmailToken])],
  providers: [GmailService, GmailAuthService],
  exports: [GmailService],
})
export class GmailModule {}
