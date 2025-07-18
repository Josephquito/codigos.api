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
    const lowerEmail = email.toLowerCase();
    const isGmail = lowerEmail.includes('@gmail.com');
    const isCatchAll = lowerEmail.endsWith('@jotavix.com');

    const isRegisteredImap = await this.imapAccountService.getByEmail(email);
    const isRegisteredGmail = await this.gmailService.tokenExists(email);

    const esCorreoValido =
      isCatchAll || isRegisteredImap || (isGmail && isRegisteredGmail);

    if (!esCorreoValido) {
      return [
        `
        <div class="text-center text-red-600 space-y-2">
          <p class="text-lg">❌ Este correo no está registrado.</p>
          <p>Contáctanos para solicitar tu código:</p>
          <a
            href="https://wa.me/message/FAVGMBVXNAFUM1"
            target="_blank"
            rel="noopener"
            class="text-[#25D366] font-semibold underline hover:text-[#1ebe5d] transition"
          >
            Ir a WhatsApp
          </a>
        </div>
        `,
      ];
    }

    const claveValida = await this.plataformaClaveService.validar(
      email,
      platform,
      clave,
    );
    if (!claveValida) {
      return [
        `<p class="text-red-600">❌ Clave incorrecta para la plataforma ${platform}</p>`,
      ];
    }

    if (isGmail && isRegisteredGmail) {
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

    return [
      `<p class="text-red-600">❌ No se reconoce el tipo de correo: ${email}</p>`,
    ];
  }
}
