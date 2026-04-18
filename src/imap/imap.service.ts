import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  HttpException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

import * as imaps from 'imap-simple';
import type { ImapSimple } from 'imap-simple';
import { simpleParser, type ParsedMail, type Source } from 'mailparser';

import { REMITENTES_POR_PLATAFORMA } from '../utils/remitentes-plataformas';

type RegisterAccountInput = {
  userId: number;
  email: string;
  password: string;
  imapHost: string;
  imapPort?: number;
  useTls?: boolean;
  isCatchAll?: boolean;
};

type UpdateAccountInput = {
  email?: string;
  password?: string;
  imapHost?: string;
  imapPort?: number;
  useTls?: boolean;
  active?: boolean;
  isCatchAll?: boolean;
};

@Injectable()
export class ImapService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // Helpers básicos
  // ============================================================

  private normEmail(email: string): string {
    return (email || '').trim().toLowerCase();
  }

  private domainFromEmail(email: string): string {
    const parts = this.normEmail(email).split('@');
    if (parts.length !== 2 || !parts[1]) {
      throw new BadRequestException(
        'El alias debe venir con dominio (ej: lalo@dominio.com)',
      );
    }
    return parts[1];
  }

  private assertNotGmail(email: string): void {
    if (/@gmail\.com$/i.test(email)) {
      throw new BadRequestException(
        'Las cuentas Gmail se gestionan en el módulo /gmail, no en /imap',
      );
    }
  }

  private imapOptions(params: {
    email: string;
    password: string;
    host: string;
    port: number;
    useTls: boolean;
  }): imaps.ImapSimpleOptions {
    const host = (params.host || '').trim().toLowerCase();
    const port = Number(params.port) || 993;

    return {
      imap: {
        user: params.email,
        password: params.password,
        host,
        port,
        tls: !!params.useTls,
        autotls: 'always',
        authTimeout: 15000,
        tlsOptions: host ? { servername: host } : undefined,
      },
    };
  }

  private async closeImap(imap?: ImapSimple) {
    if (!imap) return;
    try {
      // @ts-ignore
      if (imap['_box']) await imap.closeBox(true);
    } catch {}
    try {
      imap.end();
    } catch {}
  }

  private mailContent(parsed: ParsedMail): string {
    return (
      (parsed.html as string) ||
      (parsed.textAsHtml as string) ||
      (parsed.text as string) ||
      '<p>Correo sin contenido</p>'
    );
  }

  private getToAddress(parsed: ParsedMail): string {
    try {
      const anyTo: any = parsed.to as any;
      if (anyTo?.value?.[0]?.address)
        return String(anyTo.value[0].address).toLowerCase();
      if (Array.isArray(anyTo) && anyTo[0]?.address)
        return String(anyTo[0].address).toLowerCase();
    } catch {}
    return '';
  }

  // ============================================================
  // Resolución de cuenta
  // ============================================================

  /**
   * Dado un email (puede ser alias o cuenta real), resuelve qué ImapAccount usar:
   * 1. Busca cuenta exacta activa
   * 2. Si no existe, busca catch-all del dominio
   * Retorna { account, isCatchAllResolved, requestedAlias }
   */
  private async resolveAccount(
    userId: number,
    email: string,
  ): Promise<{
    account: any;
    isCatchAllResolved: boolean;
    requestedAlias: string;
  }> {
    const normalized = this.normEmail(email);

    // 1) Cuenta exacta
    const exact = await this.prisma.imapAccount.findFirst({
      where: { userId, email: normalized, active: true },
    });
    if (exact) {
      return {
        account: exact,
        isCatchAllResolved: false,
        requestedAlias: normalized,
      };
    }

    // 2) Catch-all del dominio
    const domain = this.domainFromEmail(normalized);
    const catchAll = await this.prisma.imapAccount.findFirst({
      where: {
        userId,
        isCatchAll: true,
        active: true,
        email: { endsWith: `@${domain}` },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!catchAll) {
      throw new NotFoundException(
        `❌ No tienes cuenta activa ni catch-all para el dominio ${domain}.`,
      );
    }

    return {
      account: catchAll,
      isCatchAllResolved: true,
      requestedAlias: normalized,
    };
  }

  private async getAccountForUser(userId: number, email: string) {
    const acc = await this.prisma.imapAccount.findFirst({
      where: { userId, email: this.normEmail(email) },
    });
    if (!acc || !acc.active)
      throw new ForbiddenException('No tienes acceso a este correo');
    return acc;
  }

  // ============================================================
  // Gestión de cuentas IMAP (CRUD)
  // ============================================================

  async registerAccount(input: RegisterAccountInput) {
    const email = this.normEmail(input.email);
    this.assertNotGmail(email);

    const password = (input.password || '').trim();
    const imapHost = (input.imapHost || '').trim();
    const imapPort = input.imapPort ?? 993;
    const useTls = input.useTls ?? true;
    const isCatchAll = input.isCatchAll ?? false;

    if (!email) throw new BadRequestException('email es requerido');
    if (!password) throw new BadRequestException('password es requerido');
    if (!imapHost) throw new BadRequestException('imapHost es requerido');

    try {
      const account = await this.prisma.imapAccount.create({
        data: {
          userId: input.userId,
          email,
          password,
          active: true,
          isCatchAll,
          imapHost,
          imapPort,
          useTls,
        },
        select: {
          id: true,
          userId: true,
          email: true,
          active: true,
          isCatchAll: true,
          imapHost: true,
          imapPort: true,
          useTls: true,
          createdAt: true,
        },
      });

      return { message: `✅ Cuenta ${email} guardada`, account };
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException(
          `⚠️ La cuenta ${email} ya está registrada para este usuario`,
        );
      }
      throw e;
    }
  }

  async getMyAccounts(userId: number) {
    return this.prisma.imapAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        active: true,
        isCatchAll: true,
        imapHost: true,
        imapPort: true,
        useTls: true,
        createdAt: true,
      },
    });
  }

  async deleteMyAccount(userId: number, accountId: number) {
    const acc = await this.prisma.imapAccount.findFirst({
      where: { id: accountId, userId },
      select: { id: true, email: true },
    });
    if (!acc) throw new NotFoundException('Cuenta no encontrada');
    await this.prisma.imapAccount.delete({ where: { id: accountId } });
    return { deleted: true, id: acc.id, email: acc.email };
  }

  async setMyAccountActive(userId: number, accountId: number, active: boolean) {
    const acc = await this.prisma.imapAccount.findFirst({
      where: { id: accountId, userId },
      select: { id: true, isCatchAll: true },
    });
    if (!acc) throw new NotFoundException('Cuenta no encontrada');

    const data: any = { active: !!active };
    if (!active) data.isCatchAll = false;

    return this.prisma.imapAccount.update({
      where: { id: accountId },
      data,
      select: {
        id: true,
        email: true,
        active: true,
        isCatchAll: true,
        imapHost: true,
        imapPort: true,
        useTls: true,
      },
    });
  }

  async setMyAccountCatchAll(
    userId: number,
    accountId: number,
    isCatchAll: boolean,
  ) {
    const acc = await this.prisma.imapAccount.findFirst({
      where: { id: accountId, userId },
      select: { id: true, active: true },
    });
    if (!acc) throw new NotFoundException('Cuenta no encontrada');

    if (isCatchAll && !acc.active) {
      throw new ForbiddenException(
        'La cuenta debe estar activa para marcarse como catch-all',
      );
    }

    return this.prisma.imapAccount.update({
      where: { id: accountId },
      data: { isCatchAll: !!isCatchAll },
      select: { id: true, email: true, active: true, isCatchAll: true },
    });
  }

  async updateMyAccount(
    userId: number,
    accountId: number,
    dto: UpdateAccountInput,
  ) {
    const existing = await this.prisma.imapAccount.findFirst({
      where: { id: accountId, userId },
      select: { id: true, active: true },
    });
    if (!existing) throw new NotFoundException('Cuenta no encontrada');

    const data = this.buildUpdateData(dto, existing.active);

    try {
      const account = await this.prisma.imapAccount.update({
        where: { id: accountId },
        data,
        select: {
          id: true,
          email: true,
          active: true,
          isCatchAll: true,
          imapHost: true,
          imapPort: true,
          useTls: true,
          createdAt: true,
        },
      });
      return { message: '✅ Cuenta IMAP actualizada', account };
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException(
          '⚠️ Ya existe una cuenta con ese email para este usuario',
        );
      }
      throw e;
    }
  }

  private buildUpdateData(dto: UpdateAccountInput, currentActive: boolean) {
    const data: any = {};

    if (dto.email !== undefined) {
      this.assertNotGmail(dto.email);
      data.email = this.normEmail(dto.email);
    }
    if (dto.password !== undefined) {
      const pass = (dto.password || '').trim();
      if (!pass) throw new BadRequestException('password no puede estar vacía');
      data.password = pass;
    }
    if (dto.imapHost !== undefined) {
      const host = (dto.imapHost || '').trim();
      if (!host) throw new BadRequestException('imapHost no puede estar vacío');
      data.imapHost = host;
    }
    if (dto.imapPort !== undefined) {
      const port = Number(dto.imapPort);
      if (!Number.isFinite(port) || port < 1 || port > 65535) {
        throw new BadRequestException('imapPort inválido');
      }
      data.imapPort = port;
    }
    if (dto.useTls !== undefined) data.useTls = !!dto.useTls;
    if (dto.active !== undefined) {
      data.active = !!dto.active;
      if (!data.active) data.isCatchAll = false;
    }
    if (dto.isCatchAll !== undefined) {
      const finalActive =
        dto.active !== undefined ? !!dto.active : currentActive;
      if (dto.isCatchAll && !finalActive) {
        throw new ForbiddenException(
          'La cuenta debe estar activa para marcarse como catch-all',
        );
      }
      data.isCatchAll = !!dto.isCatchAll;
    }

    return data;
  }

  // ============================================================
  // Lectura de correos
  // ============================================================

  /**
   * Buzón general — últimos N correos.
   * - Cuenta exacta: devuelve los últimos N sin filtro de To
   * - Catch-all resuelto: filtra por To del alias solicitado
   */
  async getLatestEmails(params: {
    userId: number;
    email: string;
    limit?: number;
  }): Promise<{ subject: string; from: string; date: string; html: string }[]> {
    this.assertNotGmail(params.email);

    const { account, isCatchAllResolved, requestedAlias } =
      await this.resolveAccount(params.userId, params.email);

    const limit = params.limit ?? 5;
    let imap: ImapSimple | undefined;

    try {
      imap = await imaps.connect(
        this.imapOptions({
          email: account.email,
          password: (account.password || '').trim(),
          host: account.imapHost,
          port: account.imapPort,
          useTls: account.useTls,
        }),
      );
      await imap.openBox('INBOX');

      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const messages = await imap.search([['SINCE', since]], {
        bodies: [''],
        markSeen: false,
      });

      const results: {
        subject: string;
        from: string;
        date: string;
        html: string;
      }[] = [];

      // Procesa de más reciente a más antiguo
      for (const msg of [...messages].reverse()) {
        if (results.length >= limit) break;

        const body = (msg.parts as any[]).find((p) => p.which === '')?.body;
        if (!body) continue;

        const parsed = await simpleParser(body as Source);

        // Si llegamos por catch-all, filtramos por To del alias solicitado
        if (isCatchAllResolved) {
          const toAddr = this.getToAddress(parsed);
          if (!toAddr.includes(requestedAlias)) continue;
        }

        results.push({
          subject: parsed.subject || '(sin asunto)',
          from: parsed.from?.text || '',
          date: parsed.date?.toISOString() || '',
          html: this.mailContent(parsed),
        });
      }

      return results;
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      console.error('❌ Error IMAP buzón general:', err);
      return [];
    } finally {
      await this.closeImap(imap);
    }
  }

  /**
   * Lectura por plataforma.
   * - Cuenta exacta: filtra solo por remitentes de plataforma
   * - Catch-all resuelto: filtra por To del alias + remitentes de plataforma
   */
  async getEmailsForAlias(params: {
    userId: number;
    email: string;
    platform: string;
  }): Promise<string[]> {
    this.assertNotGmail(params.email);

    const { account, isCatchAllResolved, requestedAlias } =
      await this.resolveAccount(params.userId, params.email);

    return this.readLatestByPlatform({
      account,
      platform: params.platform,
      aliasEmail: isCatchAllResolved ? requestedAlias : undefined,
    });
  }

  private async readLatestByPlatform(params: {
    account: any;
    platform: string;
    aliasEmail?: string;
  }): Promise<string[]> {
    const { account, platform, aliasEmail } = params;
    let imap: ImapSimple | undefined;

    try {
      imap = await imaps.connect(
        this.imapOptions({
          email: account.email,
          password: (account.password || '').trim(),
          host: account.imapHost,
          port: account.imapPort,
          useTls: account.useTls,
        }),
      );
      await imap.openBox('INBOX');

      const since = new Date(Date.now() - 12 * 60 * 60 * 1000);
      const messages = await imap.search([['SINCE', since]], {
        bodies: [''],
        markSeen: false,
      });

      const posibles =
        REMITENTES_POR_PLATAFORMA[(platform || '').toLowerCase()] || [];
      const normalizedAlias = aliasEmail ? this.normEmail(aliasEmail) : null;

      let best: { date: number; html: string } | null = null;

      for (const msg of messages) {
        const body = (msg.parts as any[]).find((p) => p.which === '')?.body;
        if (!body) continue;

        const parsed = await simpleParser(body as Source);

        // Filtra por To solo si llegamos por catch-all
        if (normalizedAlias) {
          const toAddr = this.getToAddress(parsed);
          if (!toAddr.includes(normalizedAlias)) continue;
        }

        const fromText = parsed.from?.text?.toLowerCase?.() || '';
        const fromAddr =
          parsed.from?.value?.[0]?.address?.toLowerCase?.() || '';
        const received = parsed.date?.getTime?.() || 0;

        const remitenteOk = posibles.some(
          (r: string) => fromText.includes(r) || fromAddr.includes(r),
        );
        if (!remitenteOk) continue;
        if (received <= since.getTime()) continue;

        const html = this.mailContent(parsed);
        if (!best || received > best.date) best = { date: received, html };
      }

      if (!best) {
        const label = normalizedAlias ?? this.normEmail(account.email);
        return [
          `<p>❌ No hay correos recientes de <b>${platform}</b> para <b>${label}</b> en las últimas 12h.</p>`,
        ];
      }

      return [best.html];
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      console.error('❌ Error IMAP:', err);
      return ['<p>Error al filtrar correos</p>'];
    } finally {
      await this.closeImap(imap);
    }
  }
}
