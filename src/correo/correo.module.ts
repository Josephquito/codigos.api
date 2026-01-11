// correo/correo.module.ts
import { Module } from '@nestjs/common';
import { CorreoController } from './correo.controller';
import { CorreoService } from './correo.service';

import { PlataformasModule } from '../plataformas/plataformas.module';
import { GmailModule } from '../gmail/gmail.module';
import { ImapModule } from '../imap/imap.module';

@Module({
  imports: [PlataformasModule, GmailModule, ImapModule],
  controllers: [CorreoController],
  providers: [CorreoService],
})
export class CorreoModule {}
