import { Injectable } from '@nestjs/common';
import { ImapAccountService } from '../imap-account/imap-account.service';
import { ImapService } from '../imap/imap.service';
import { GmailService } from '../gmail/gmail.service';
import { PlataformaClaveService } from '../plataformas/plataforma-clave.service';

@Injectable()
export class CorreoService {
  constructor(
    private readonly imapAccountService: ImapAccountService,
    private readonly imapService: ImapService,
    private readonly gmailService: GmailService,
    private readonly plataformaClaveService: PlataformaClaveService,
  ) {}

  async getCorreoUnificado(
    email: string,
    platform: string,
    clave: string,
  ): Promise<string[]> {
    // Validar clave antes de continuar
    const claveValida = await this.plataformaClaveService.validar(
      email,
      platform,
      clave,
    );
    if (!claveValida) {
      return [`<p>❌ Clave incorrecta para la plataforma ${platform}</p>`];
    }

    const isGmail = email.toLowerCase().includes('@gmail.com');
    const isCatchAll = email.toLowerCase().endsWith('@jotavix.com');
    const isRegisteredImap = await this.imapAccountService.getByEmail(email);

    if (isGmail) {
      return this.gmailService.getEmailsForAliasFromPlatform(email, platform);
    }

    if (isRegisteredImap) {
      return this.imapService.getEmailsFromRegisteredAccountByPlatform(
        email,
        platform,
      );
    }

    if (isCatchAll) {
      return this.imapService.getEmailsForAliasFromPlatform(email, platform);
    }

    return [`<p>❌ No se reconoce el tipo de correo: ${email}</p>`];
  }
}
