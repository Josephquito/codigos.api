import { Module } from '@nestjs/common';
import { CorreoService } from './correo.service';
import { CorreoController } from './correo.controller';
import { ImapService } from '../imap/imap.service';
import { GmailService } from '../gmail/gmail.service';

import { AuthModule } from 'src/auth/auth.module';
import { ImapAccountModule } from 'src/imap-account/imap-account.module';
import { AuthService } from 'src/auth/auth.service';

@Module({
  imports: [ImapAccountModule, AuthModule, AuthService],
  controllers: [CorreoController],
  providers: [CorreoService, ImapService, GmailService],
})
export class CorreoModule {}
