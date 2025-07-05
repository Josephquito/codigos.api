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
    return this.authService.generateAuthUrl(email); // 👈 usa el método que tengas para generar el cliente OAuth
  }

  async getLastEmailHtml(email: string): Promise<string> {
    const auth = await this.authService.loadToken(email); // 👈 AÑADIR AWAIT
    if (!auth) {
      throw new Error(`❌ No hay token guardado para el correo: ${email}`);
    }

    const gmail = google.gmail({ version: 'v1', auth });

    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 1,
    });

    const messageId = response.data.messages?.[0]?.id;
    if (!messageId) {
      throw new Error('📭 No se encontraron mensajes recientes');
    }

    const message = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'raw',
    });

    const raw = message.data.raw;
    if (!raw) {
      throw new Error('📄 No se pudo obtener el contenido del correo');
    }

    const buffer = Buffer.from(raw, 'base64');
    let parsedHtml = '<p>(Correo sin contenido HTML)</p>';

    try {
      const parsed: ParsedMail = await simpleParser(buffer);
      parsedHtml = parsed.html || parsed.textAsHtml || parsedHtml;
    } catch (err) {
      console.error('Error al parsear el correo:', err);
    }

    return parsedHtml;
  }
}
