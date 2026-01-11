import { Module } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { GmailAuthService } from './gmail-auth.service';
import { GmailController } from './gmail.controller';
import { GmailAuthController } from './gmail-auth.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GmailController, GmailAuthController],
  providers: [GmailService, GmailAuthService],
  exports: [GmailService, GmailAuthService],
})
export class GmailModule {}
