// src/gmail/gmail.service.ts
import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { simpleParser, ParsedMail } from 'mailparser';
import { AuthService } from '../auth/auth.service';
import { Buffer } from 'buffer';

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
      if (
        toAddress.includes(alias.toLowerCase()) &&
        (fromText.includes(platformLower) ||
          fromAddress.includes(platformLower)) &&
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

  async getLastEmailHtml(email: string): Promise<string> {
    const auth = await this.authService.loadToken(email);
    if (!auth) throw new Error(`No se encontró token para ${email}`);

    const gmail = google.gmail({ version: 'v1', auth });

    const list = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 1,
    });

    const id = list.data.messages?.[0]?.id;
    if (!id) throw new Error('No hay mensajes recientes');

    const msg = await gmail.users.messages.get({
      userId: 'me',
      id,
      format: 'raw',
    });

    const raw = msg.data.raw;
    if (!raw) throw new Error('Correo vacío');

    const parsed: ParsedMail = await simpleParser(Buffer.from(raw, 'base64'));
    return (
      parsed.html ||
      parsed.textAsHtml ||
      parsed.text ||
      '<p>Correo sin contenido</p>'
    );
  }

  getAuthUrl(email: string): string {
    return this.authService.generateAuthUrl(email);
  }
}
