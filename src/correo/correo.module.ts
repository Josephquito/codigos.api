import { Module } from '@nestjs/common';
import { CorreoService } from './correo.service';
import { CorreoController } from './correo.controller';
import { ImapService } from '../imap/imap.service';
import { GmailService } from '../gmail/gmail.service';
import { GmailModule } from '../gmail/gmail.module';
import { GmailAuthModule } from 'src/gmail-auth/gmail-auth.module';
import { ImapAccountModule } from 'src/imap-account/imap-account.module';

@Module({
  imports: [ImapAccountModule, GmailAuthModule, GmailModule],
  controllers: [CorreoController],
  providers: [CorreoService, ImapService, GmailService],
})
export class CorreoModule {}
