import { Module } from '@nestjs/common';
import { CorreoService } from './correo.service';
import { CorreoController } from './correo.controller';
import { ImapService } from '../imap/imap.service';
import { GmailService } from '../gmail/gmail.service';
import { ImapAccountService } from '../imap-account/imap-account.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CorreoController],
  providers: [CorreoService, ImapService, GmailService, ImapAccountService],
})
export class CorreoModule {}
