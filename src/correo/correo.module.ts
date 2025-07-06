import { Module } from '@nestjs/common';
import { CorreoService } from './correo.service';
import { CorreoController } from './correo.controller';
import { ImapService } from '../imap/imap.service';
import { GmailService } from '../gmail/gmail.service';
import { ImapAccountService } from '../imap-account/imap-account.service';

@Module({
  controllers: [CorreoController],
  providers: [CorreoService, ImapService, GmailService, ImapAccountService],
})
export class CorreoModule {}
