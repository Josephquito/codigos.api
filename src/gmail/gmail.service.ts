import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { google } from 'googleapis';
import { simpleParser, ParsedMail } from 'mailparser';
import { Buffer } from 'buffer';
import { GmailAuthService } from './gmail-auth.service';
import { REMITENTES_POR_PLATAFORMA } from '../utils/remitentes-plataformas';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GmailService {
  constructor(
    private readonly gmailAuthService: GmailAuthService,
    private readonly prisma: PrismaService,
  ) {}

  private assertGmail(email: string) {
    if (!/@gmail\.com$/i.test(email)) {
      throw new BadRequestException('El correo debe ser @gmail.com');
    }
  }

  async tokenExists(userId: number, email: string): Promise<boolean> {
    this.assertGmail(email);

    const found = await this.prisma.gmailToken.findUnique({
      where: { userId_email: { userId, email } },
      select: { id: true, active: true },
    });

    return !!found?.id && !!found.active;
  }

  // ✅ 2) Listar mis cuentas Gmail registradas
  async listMyAccounts(userId: number) {
    const rows = await this.prisma.gmailToken.findMany({
      where: { userId },
      select: {
        id: true,
        email: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows;
  }

  // ✅ 4) Eliminar cuenta (solo dueño)
  async deleteMyAccount(userId: number, email: string) {
    this.assertGmail(email);

    const row = await this.prisma.gmailToken.findUnique({
      where: { userId_email: { userId, email } },
      select: { id: true, token: true },
    });

    if (!row) throw new NotFoundException('Cuenta no registrada');

    await this.prisma.gmailToken.delete({
      where: { userId_email: { userId, email } },
    });

    return { deleted: true, email };
  }

  getAuthUrl(userId: number, email: string): string {
    this.assertGmail(email);
    return this.gmailAuthService.generateAuthUrl(userId, email);
  }

  // ✅ 5) Lectura por alias/plataforma (tu método, endurecido)
  async getEmailsForAliasFromPlatform(
    userId: number,
    alias: string,
    platform: string,
  ): Promise<string[]> {
    this.assertGmail(alias);

    const auth = await this.gmailAuthService.loadClient(userId, alias);
    if (!auth) return [`<p>❌ No se encontró token activo para ${alias}</p>`];

    const gmail = google.gmail({ version: 'v1', auth });

    const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 20,
      q: 'newer_than:12h',
    });

    const messages = Array.isArray(listRes.data.messages)
      ? listRes.data.messages
      : [];

    const messageIds = messages
      .map((m) => m.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    if (messageIds.length === 0) {
      return [`<p>❌ No hay correos recientes (últimas 12h) para revisar</p>`];
    }

    const results: string[] = [];
    const platformLower = platform.toLowerCase();
    const posibles = REMITENTES_POR_PLATAFORMA[platformLower] || [];

    for (const id of messageIds) {
      const res = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'raw',
      });

      const raw = res.data.raw;
      if (!raw) continue;

      const parsed: ParsedMail = await simpleParser(Buffer.from(raw, 'base64'));

      let toAddress = '';
      try {
        const toAny: any = parsed.to as any;
        toAddress = toAny?.value?.[0]?.address?.toLowerCase() ?? '';
      } catch {}

      const fromText = parsed.from?.text?.toLowerCase() || '';
      const fromAddress = parsed.from?.value?.[0]?.address?.toLowerCase() || '';
      const date = parsed.date?.getTime() || 0;

      if (
        toAddress.includes(alias.toLowerCase()) &&
        posibles.some((r) => fromText.includes(r) || fromAddress.includes(r)) &&
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
}
