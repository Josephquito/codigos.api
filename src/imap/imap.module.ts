import { Module } from '@nestjs/common';
import { ImapService } from './imap.service';
import { ImapController } from './imap.controller';
import { ImapAccountModule } from '../imap-account/imap-account.module'; // 👈 Asegúrate de importar esto
import { GmailAuthModule } from 'src/gmail-auth/gmail-auth.module';

@Module({
  imports: [ImapAccountModule, GmailAuthModule], // 👈 Importarlo aquí
  providers: [ImapService],
  controllers: [ImapController],
})
export class ImapModule {}
