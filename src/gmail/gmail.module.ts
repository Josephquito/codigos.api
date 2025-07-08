// gmail.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GmailService } from './gmail.service';
import { GmailAuthService } from '../gmail-auth/gmail-auth.service';
import { GmailToken } from './entities/gmail-token.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GmailToken])],
  providers: [GmailService, GmailAuthService],
  exports: [GmailService, GmailAuthService, TypeOrmModule], // 👈 exportamos para que otros módulos lo usen
})
export class GmailModule {}
