import { Injectable } from '@nestjs/common';
import * as imaps from 'imap-simple';
import { simpleParser, ParsedMail, Source } from 'mailparser';
import { ImapSimple, Message } from 'imap-simple';
import { ImapAccountService } from '../imap-account/imap-account.service';
import { REMITENTES_POR_PLATAFORMA } from '../utils/remitentes-plataformas';

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

      const result: { content: string; date: number }[] = [];
      const platformLower = platform.toLowerCase();

      for (const msg of messages) {
        const parts = msg.parts as any[];
        const bodyPart = parts.find((part) => part.which === '');
        if (!bodyPart) continue;

        const parsed: ParsedMail = await simpleParser(bodyPart.body as Source);

        let toAddress = '';
        try {
          if (Array.isArray(parsed.to)) {
            toAddress = (parsed.to[0] as any)?.address?.toLowerCase();
          } else if ('value' in parsed.to!) {
            toAddress = (parsed.to as any).value?.[0]?.address?.toLowerCase();
          }
        } catch (e) {}

        const fromText = parsed.from?.text?.toLowerCase() || '';
        const fromAddress =
          parsed.from?.value?.[0]?.address?.toLowerCase() || '';
        const receivedDate = parsed.date?.getTime() || 0;

        const posibles = REMITENTES_POR_PLATAFORMA[platformLower] || [];

        const isAliasMatch = toAddress.includes(alias.toLowerCase());
        const isRemitenteMatch = posibles.some(
          (remitente) =>
            fromText.includes(remitente) || fromAddress.includes(remitente),
        );

        if (isAliasMatch && isRemitenteMatch && receivedDate > twelveHoursAgo) {
          result.push({
            content:
              parsed.html ||
              parsed.textAsHtml ||
              parsed.text ||
              '<p>Correo sin contenido</p>',
            date: receivedDate,
          });
        }
      }

      if (!result.length) {
        return [
          `<p>❌ No hay correos recientes de ${platform} para ${alias}</p>`,
        ];
      }

      const masReciente = result.sort((a, b) => b.date - a.date)[0].content;
      return [masReciente];
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
  async getEmailsFromRegisteredAccountByPlatform(
    email: string,
    platform: string,
  ): Promise<string[]> {
    const account = await this.imapAccountService.getByEmail(email);
    if (!account) {
      return [`<p>❌ No se encontró la cuenta ${email}</p>`];
    }

    let imap: ImapSimple;
    try {
      imap = await imaps.connect(
        this.getDynamicConfig(account.email, account.password),
      );
      await imap.openBox('INBOX');

      const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
      const messages = await imap.search(['ALL'], {
        bodies: [''],
        markSeen: false,
      });

      const result: { content: string; date: number }[] = [];
      const platformLower = platform.toLowerCase();
      const posibles = REMITENTES_POR_PLATAFORMA[platformLower] || [];

      for (const msg of messages) {
        const parts = msg.parts as any[];
        const bodyPart = parts.find((part) => part.which === '');
        if (!bodyPart) continue;

        const parsed: ParsedMail = await simpleParser(bodyPart.body as Source);

        let toAddress = '';
        try {
          if (Array.isArray(parsed.to)) {
            toAddress = (parsed.to[0] as any)?.address?.toLowerCase();
          } else if ('value' in parsed.to!) {
            toAddress = (parsed.to as any).value?.[0]?.address?.toLowerCase();
          }
        } catch {}

        const fromText = parsed.from?.text?.toLowerCase() || '';
        const fromAddress =
          parsed.from?.value?.[0]?.address?.toLowerCase() || '';
        const receivedDate = parsed.date?.getTime() || 0;

        const isAliasMatch = toAddress.includes(email.toLowerCase());
        const isRemitenteMatch = posibles.some(
          (remitente) =>
            fromText.includes(remitente) || fromAddress.includes(remitente),
        );

        if (isAliasMatch && isRemitenteMatch && receivedDate > twelveHoursAgo) {
          result.push({
            content:
              parsed.html ||
              parsed.textAsHtml ||
              parsed.text ||
              '<p>Correo sin contenido</p>',
            date: receivedDate,
          });
        }
      }

      if (!result.length) {
        return [
          `<p>❌ No hay correos recientes de ${platform} para ${email}</p>`,
        ];
      }

      const masReciente = result.sort((a, b) => b.date - a.date)[0].content;
      return [masReciente];
    } catch (error) {
      console.error('❌ Error filtrando correos dinámicamente:', error);
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
}
