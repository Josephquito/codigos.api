import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { simpleParser, ParsedMail } from 'mailparser';
import { AuthService } from '../auth/auth.service';
import { Buffer } from 'buffer';
import { REMITENTES_POR_PLATAFORMA } from '../utils/remitentes-plataformas';

@Injectable()
export class GmailService {
  constructor(private readonly authService: AuthService) {}

  async getEmailsForAliasFromPlatform(
    alias: string,
    platform: string,
  ): Promise<string[]> {
    const auth = await this.authService.loadToken(alias);
    if (!auth) {
      return [`<p>❌ No se encontró token para ${alias}</p>`];
    }

    const gmail = google.gmail({ version: 'v1', auth });

    const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 20,
      q: 'newer_than:12h',
    });

    const messageIds = listRes.data.messages?.map((m) => m.id) ?? [];
    const results: string[] = [];

    for (const id of messageIds) {
      if (!id) continue;

      const res = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'raw',
      });

      const raw = res.data.raw;
      if (!raw) continue;

      const parsed: ParsedMail = await simpleParser(Buffer.from(raw, 'base64'));

      // Obtener dirección del destinatario
      let toAddress = '';
      try {
        if (Array.isArray(parsed.to)) {
          toAddress = (parsed.to[0] as any)?.address?.toLowerCase();
        } else if ('value' in parsed.to!) {
          toAddress = (parsed.to as any).value?.[0]?.address?.toLowerCase();
        }
      } catch (e) {}

      const fromText = parsed.from?.text?.toLowerCase() || '';
      const fromAddress = parsed.from?.value?.[0]?.address?.toLowerCase() || '';
      const platformLower = platform.toLowerCase();
      const date = parsed.date?.getTime() || 0;
      const posibles = REMITENTES_POR_PLATAFORMA[platformLower] || [];

      if (
        toAddress.includes(alias.toLowerCase()) &&
        posibles.some(
          (remitente) =>
            fromText.includes(remitente) || fromAddress.includes(remitente),
        ) &&
        date > twelveHoursAgo
      ) {
        results.push(
          parsed.html ||
            parsed.textAsHtml ||
            parsed.text ||
            '<p>Correo sin contenido</p>',
        );
      }
    }

    return results.length
      ? results
      : [`<p>❌ No hay correos recientes de ${platform} para ${alias}</p>`];
  }

  getAuthUrl(email: string): string {
    return this.authService.generateAuthUrl(email);
  }
}
