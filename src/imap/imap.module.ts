import { Module } from '@nestjs/common';
import { ImapService } from './imap.service';
import { ImapController } from './imap.controller';
import { ImapAccountModule } from '../imap-account/imap-account.module'; // 👈 Asegúrate de importar esto
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [ImapAccountModule, AuthModule], // 👈 Importarlo aquí
  providers: [ImapService],
  controllers: [ImapController],
})
export class ImapModule {}
