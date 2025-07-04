import { Injectable } from '@nestjs/common';
import * as imaps from 'imap-simple';
import { simpleParser, ParsedMail, Source } from 'mailparser';
import { ImapSimple, Message } from 'imap-simple';

@Injectable()
export class ImapService {
  private readonly config: imaps.ImapSimpleOptions = {
    imap: {
      user: 'global@jotavix.com',
      password: 'Ellayyo.1234@', // asegúrate que sea la correcta
      host: 'premium31-5.web-hosting.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }, // evita error TLS
      authTimeout: 3000,
    },
  };

  async getLastEmailHtml(): Promise<string> {
    try {
      const imap = (await imaps.connect(this.config)) as ImapSimple;
      await imap.openBox('INBOX');

      const messages = (await imap.search(['ALL'], {
        bodies: [''],
        markSeen: false,
      })) as Message[];

      if (!messages.length) return '<p>No hay mensajes</p>';

      const latest = messages[messages.length - 1];
      const parts = latest.parts as {
        which: string;
        size: number;
        body: string | Buffer;
      }[];

      const bodyPart = parts.find((part) => part.which === '');
      const raw = bodyPart?.body;
      if (!raw) return '<p>Correo vacío</p>';

      const parsed: ParsedMail = await simpleParser(raw as Source);

      return (
        parsed.html ||
        parsed.textAsHtml ||
        parsed.text ||
        '<p>Correo sin contenido</p>'
      );
    } catch (error) {
      console.error('❌ Error leyendo correo:', error);
      return '<p>Error al leer el correo</p>';
    }
  }
  async getEmailsForAliasFromPlatform(
    alias: string,
    platform: string,
  ): Promise<string[]> {
    try {
      const imap = (await imaps.connect(this.config)) as ImapSimple;
      await imap.openBox('INBOX');

      const messages = (await imap.search(['ALL'], {
        bodies: [''],
        markSeen: false,
      })) as Message[];

      const result: string[] = [];

      for (const msg of messages) {
        const parts = msg.parts as {
          which: string;
          size: number;
          body: string | Buffer;
        }[];
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

        if (
          toAddress === alias.toLowerCase() &&
          from.includes(platform.toLowerCase()) // filtro por plataforma en remitente
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
        : [`<p>No hay correos de ${platform} para ${alias}</p>`];
    } catch (error) {
      console.error('❌ Error filtrando por alias + plataforma:', error);
      return ['<p>Error al filtrar correos</p>'];
    }
  }
}
