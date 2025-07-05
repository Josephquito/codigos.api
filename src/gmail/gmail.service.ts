// src/gmail/gmail.service.ts
import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { AuthService } from '../auth/auth.service';
import { simpleParser, ParsedMail } from 'mailparser';
import { Buffer } from 'buffer';

@Injectable()
export class GmailService {
  constructor(private readonly authService: AuthService) {}

  getAuthUrl(email: string): string {
    return this.authService.generateAuthUrl(email);
  }

  async getLastEmailHtml(email: string): Promise<string> {
    const auth = await this.authService.loadToken(email);
    if (!auth) throw new Error(`❌ No hay token guardado para: ${email}`);

    const gmail = google.gmail({ version: 'v1', auth });
    const res = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 1,
    });

    const msgId = res.data.messages?.[0]?.id;
    if (!msgId) return '<p>No se encontraron mensajes</p>';

    const rawMsg = await gmail.users.messages.get({
      userId: 'me',
      id: msgId,
      format: 'raw',
    });

    const raw = rawMsg.data.raw;
    if (!raw) return '<p>Correo vacío</p>';

    const parsed: ParsedMail = await simpleParser(Buffer.from(raw, 'base64'));

    return (
      parsed.html || parsed.textAsHtml || parsed.text || '<p>Sin contenido</p>'
    );
  }

  async getEmailsForAliasFromPlatform(
    email: string,
    platform: string,
  ): Promise<string[]> {
    const auth = await this.authService.loadToken(email);
    if (!auth) throw new Error(`❌ No hay token guardado para: ${email}`);

    const gmail = google.gmail({ version: 'v1', auth });
    const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 30,
      q: 'newer_than:12h',
    });

    const messageIds = listRes.data.messages?.map((m) => m.id) || [];
    const results: string[] = [];

    for (const id of messageIds) {
      const res = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'raw',
      });

      const raw = res.data.raw;
      if (!raw) continue;

      const parsed: ParsedMail = await simpleParser(Buffer.from(raw, 'base64'));

      const to =
        parsed.to?.[0]?.address?.toLowerCase() ||
        parsed.to?.value?.[0]?.address?.toLowerCase() ||
        '';

      const from = parsed.from?.text?.toLowerCase() || '';
      const date = parsed.date?.getTime() || 0;

      if (
        to === email.toLowerCase() &&
        from.includes(platform.toLowerCase()) &&
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
      : [`<p>No hay correos recientes de ${platform} para ${email}</p>`];
  }
}
