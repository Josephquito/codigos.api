import { Injectable } from '@nestjs/common';
import * as imaps from 'imap-simple';
import { simpleParser, ParsedMail, Source } from 'mailparser';
import { ImapSimple, Message } from 'imap-simple';
import { ImapAccountService } from '../imap-account/imap-account.service';

@Injectable()
export class ImapService {
  constructor(private readonly imapAccountService: ImapAccountService) {}

  private readonly config: imaps.ImapSimpleOptions = {
    imap: {
      user: process.env.HOST_EMAIL,
      password: process.env.HOST_PASSWORD,
      host: process.env.IMAP_HOST,
      port: Number(process.env.IMAP_PORT) || 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 3000,
    },
  };

  private getDynamicConfig(
    email: string,
    password: string,
  ): imaps.ImapSimpleOptions {
    return {
      imap: {
        user: email,
        password: password,
        host: process.env.IMAP_HOST,
        port: Number(process.env.IMAP_PORT) || 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 3000,
      },
    };
  }

  async getLastEmailHtml(): Promise<string> {
    let imap: ImapSimple;
    try {
      imap = await imaps.connect(this.config);
      await imap.openBox('INBOX');

      const messages = await imap.search(['ALL'], {
        bodies: [''],
        markSeen: false,
      });

      if (!messages.length) return '<p>No hay mensajes</p>';

      const latest = messages[messages.length - 1];
      const parts = latest.parts as any[];
      const bodyPart = parts.find((part) => part.which === '');
      if (!bodyPart) return '<p>Correo vacío</p>';

      const parsed: ParsedMail = await simpleParser(bodyPart.body as Source);
      return (
        parsed.html ||
        parsed.textAsHtml ||
        parsed.text ||
        '<p>Correo sin contenido</p>'
      );
    } catch (error) {
      console.error('❌ Error leyendo correo:', error);
      return '<p>Error al leer el correo</p>';
    } finally {
      if (imap) {
        try {
          await imap.closeBox(true);
          imap.end();
        } catch (closeErr) {
          console.error('Error cerrando IMAP:', closeErr);
        }
      }
    }
  }

  async getEmailsForAliasFromPlatform(
    alias: string,
    platform: string,
  ): Promise<string[]> {
    let imap: ImapSimple;
    try {
      imap = await imaps.connect(this.config);
      await imap.openBox('INBOX');

      const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
      const messages = await imap.search(['ALL'], {
        bodies: [''],
        markSeen: false,
      });

      const result: string[] = [];

      for (const msg of messages) {
        const parts = msg.parts as any[];
        const bodyPart = parts.find((part) => part.which === '');
        if (!bodyPart) continue;

        const parsed: ParsedMail = await simpleParser(bodyPart.body as Source);

        let toAddress: string | undefined;
        if (Array.isArray(parsed.to)) {
          toAddress = (parsed.to[0] as any)?.address?.toLowerCase();
        } else if (parsed.to && 'value' in parsed.to) {
          toAddress = parsed.to.value?.[0]?.address?.toLowerCase();
        }

        const from = parsed.from?.text?.toLowerCase() || '';
        const receivedDate = parsed.date?.getTime() || 0;

        if (
          toAddress === alias.toLowerCase() &&
          from.includes(platform.toLowerCase()) &&
          receivedDate > twelveHoursAgo
        ) {
          result.push(
            parsed.html ||
              parsed.textAsHtml ||
              parsed.text ||
              '<p>Correo sin contenido</p>',
          );
        }
      }

      return result.length
        ? result
        : [`<p>No hay correos recientes de ${platform} para ${alias}</p>`];
    } catch (error) {
      console.error('❌ Error filtrando correos:', error);
      return ['<p>Error al filtrar correos</p>'];
    } finally {
      if (imap) {
        try {
          await imap.closeBox(true);
          imap.end();
        } catch (closeErr) {
          console.error('Error cerrando IMAP:', closeErr);
        }
      }
    }
  }

  async getLastEmailFromRegisteredAccount(email: string): Promise<string> {
    const account = await this.imapAccountService.getByEmail(email);
    if (!account) {
      return `<p>❌ No se encontró la cuenta ${email}</p>`;
    }

    let imap: ImapSimple;
    try {
      imap = await imaps.connect(
        this.getDynamicConfig(account.email, account.password),
      );
      await imap.openBox('INBOX');

      const messages = await imap.search(['ALL'], {
        bodies: [''],
        markSeen: false,
      });

      if (!messages.length) return '<p>No hay mensajes</p>';

      const latest = messages[messages.length - 1];
      const parts = latest.parts as any[];
      const bodyPart = parts.find((part) => part.which === '');
      if (!bodyPart) return '<p>Correo vacío</p>';

      const parsed: ParsedMail = await simpleParser(bodyPart.body as Source);
      return (
        parsed.html ||
        parsed.textAsHtml ||
        parsed.text ||
        '<p>Correo sin contenido</p>'
      );
    } catch (err) {
      console.error('❌ Error leyendo correo IMAP:', err);
      return '<p>Error al leer el correo</p>';
    } finally {
      if (imap) {
        try {
          await imap.closeBox(true);
          imap.end();
        } catch (closeErr) {
          console.error('Error cerrando IMAP:', closeErr);
        }
      }
    }
  }
}
