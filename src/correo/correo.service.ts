import { Injectable } from '@nestjs/common';
import { ImapAccountService } from '../imap-account/imap-account.service';
import { ImapService } from '../imap/imap.service';
import { GmailService } from '../gmail/gmail.service';

@Injectable()
export class CorreoService {
  constructor(
    private readonly imapAccountService: ImapAccountService,
    private readonly imapService: ImapService,
    private readonly gmailService: GmailService,
  ) {}

  async getCorreoUnificado(
    email: string,
    platform: string,
    clave: string,
  ): Promise<string[]> {
    const isGmail = email.toLowerCase().includes('@gmail.com');
    const isCatchAll = email.toLowerCase().endsWith('@jotavix.com');
    const isRegisteredImap = await this.imapAccountService.getByEmail(email);

    if (isGmail) {
      // 1. Cuenta de Gmail autenticada
      return this.gmailService.getEmailsForAliasFromPlatform(
        email,
        platform,
        clave,
      );
    }

    if (isRegisteredImap) {
      // 2. Cuenta IMAP registrada individualmente (en DB)
      return this.imapService.getEmailsFromRegisteredAccountByPlatform(
        email,
        platform,
        clave,
      );
    }

    if (isCatchAll) {
      // 3. Cuenta IMAP global tipo catch-all
      return this.imapService.getEmailsForAliasFromPlatform(
        email,
        platform,
        clave,
      );
    }

    return [`<p>❌ No se reconoce el tipo de correo: ${email}</p>`];
  }
}
