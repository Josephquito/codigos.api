// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { GmailToken } from '../gmail/entities/gmail-token.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GmailToken])],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
