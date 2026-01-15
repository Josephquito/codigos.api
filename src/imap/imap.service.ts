// src/imap/imap.service.ts
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

  /** Normaliza un email para comparaciones y guardado consistente */
  private normEmail(email: string): string {
    return (email || '').trim().toLowerCase();
  }

  /** Extrae dominio del email (requiere formato usuario@dominio) */
  private domainFromEmail(email: string): string {
    const parts = this.normEmail(email).split('@');
    if (parts.length !== 2 || !parts[1]) {
      throw new BadRequestException(
        'El alias debe venir con dominio (ej: lalo@dominio.com)',
      );
    }
    return parts[1];
  }

  /** Construye configuración IMAP para imap-simple */
  private imapOptions(params: {
    email: string;
    password: string;
    host: string;
    port: number;
    useTls: boolean;
  }): imaps.ImapSimpleOptions {
    const host = (params.host || '').trim().toLowerCase();
    const port = Number(params.port) || 993;

    // Logs internos (no exponer al usuario)
    console.log('[IMAP] host=', host, 'port=', port, 'tls=', !!params.useTls);
    console.log(
      '[IMAP] user=',
      params.email,
      'passLen=',
      params.password?.length || 0,
    );

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

  /** Cierra conexión IMAP de forma segura */
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

  /** Devuelve el contenido (HTML/text) de un correo parseado */
  private mailContent(parsed: ParsedMail): string {
    return (
      (parsed.html as string) ||
      (parsed.textAsHtml as string) ||
      (parsed.text as string) ||
      '<p>Correo sin contenido</p>'
    );
  }

  /** Obtiene el "to" principal en formato email (si existe) */
  private getToAddress(parsed: ParsedMail): string {
    try {
      const anyTo: any = parsed.to as any;

      // Caso típico mailparser: { value: [{ address: 'x@y.com' }] }
      if (anyTo?.value?.[0]?.address)
        return String(anyTo.value[0].address).toLowerCase();

      // Otros casos
      if (Array.isArray(anyTo) && anyTo[0]?.address)
        return String(anyTo[0].address).toLowerCase();
    } catch {}

    return '';
  }

  // ============================================================
  // Gestión de cuentas IMAP (CRUD)
  // ============================================================

  /** Crea una cuenta IMAP para el usuario (no permite duplicados por usuario) */
  async registerAccount(input: RegisterAccountInput) {
    const email = this.normEmail(input.email);
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

  /** Lista las cuentas del usuario (sin password) */
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

  /** Elimina una cuenta IMAP del usuario */
  async deleteMyAccount(userId: number, accountId: number) {
    const acc = await this.prisma.imapAccount.findFirst({
      where: { id: accountId, userId },
      select: { id: true, email: true },
    });
    if (!acc) throw new NotFoundException('Cuenta no encontrada');

    await this.prisma.imapAccount.delete({ where: { id: accountId } });
    return { deleted: true, id: acc.id, email: acc.email };
  }

  /** Activa/desactiva una cuenta del usuario */
  async setMyAccountActive(userId: number, accountId: number, active: boolean) {
    // ownership enforced
    const acc = await this.prisma.imapAccount.findFirst({
      where: { id: accountId, userId },
      select: { id: true, isCatchAll: true },
    });
    if (!acc) throw new NotFoundException('Cuenta no encontrada');

    // Si queda inactiva, apagamos catch-all automáticamente (regla simple)
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

  /** Marca/desmarca catch-all; requiere que la cuenta esté activa */
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

  /** Edita una cuenta IMAP del usuario (host/port/tls/email/password/active/catchall) */
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

  /** Construye el "data" de Prisma para update con validaciones mínimas */
  private buildUpdateData(dto: UpdateAccountInput, currentActive: boolean) {
    const data: any = {};

    if (dto.email !== undefined) data.email = this.normEmail(dto.email);
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

    // Si actualizas active, y queda false => apagar catch-all
    if (dto.active !== undefined) {
      data.active = !!dto.active;
      if (!data.active) data.isCatchAll = false;
    }

    // Si actualizas catch-all, exige que la cuenta quede activa
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
  // Lectura IMAP (unificada)
  // ============================================================

  /** Obtiene credenciales de una cuenta del usuario (no filtra info sensible en errores) */
  private async getAccountForUser(userId: number, email: string) {
    const acc = await this.prisma.imapAccount.findFirst({
      where: { userId, email: this.normEmail(email) },
    });

    // Mensaje único para no filtrar si existe o está inactiva
    if (!acc || !acc.active)
      throw new ForbiddenException('No tienes acceso a este correo');

    return acc;
  }

  /** Resuelve catch-all por dominio del alias (debe existir y estar activa) */
  private async resolveCatchAll(userId: number, aliasEmail: string) {
    const domain = this.domainFromEmail(aliasEmail);

    const acc = await this.prisma.imapAccount.findFirst({
      where: {
        userId,
        isCatchAll: true,
        active: true,
        email: { endsWith: `@${domain}` },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!acc) {
      throw new NotFoundException(
        `❌ No tienes un catch-all activo para el dominio ${domain}. Marca como catch-all una cuenta de ese dominio.`,
      );
    }

    return acc;
  }

  /**
   * Catch-all por dominio: devuelve el correo más reciente de una plataforma para un alias (últimas 12h)
   */
  async getEmailsForAliasFromPlatform(params: {
    userId: number;
    aliasEmail: string;
    platform: string;
  }): Promise<string[]> {
    const acc = await this.resolveCatchAll(params.userId, params.aliasEmail);
    return this.readLatestByPlatform({
      account: acc,
      platform: params.platform,
      aliasEmail: params.aliasEmail, // filtra por "To"
    });
  }

  /**
   * Cuenta específica: devuelve el correo más reciente de una plataforma (últimas 12h)
   */
  async getEmailsFromAccountByPlatform(params: {
    userId: number;
    email: string;
    platform: string;
  }): Promise<string[]> {
    const acc = await this.getAccountForUser(params.userId, params.email);
    return this.readLatestByPlatform({
      account: acc,
      platform: params.platform,
      aliasEmail: undefined, // no filtra por "To"
    });
  }

  /**
   * Lee INBOX y devuelve el correo más reciente de la plataforma (últimas 12h).
   * - Si aliasEmail está definido, también filtra por destinatario (To)
   */
  private async readLatestByPlatform(params: {
    account: any; // imapAccount completo (incluye password)
    platform: string;
    aliasEmail?: string;
  }): Promise<string[]> {
    const { account, platform, aliasEmail } = params;

    let imap: ImapSimple | undefined;

    try {
      const config = this.imapOptions({
        email: account.email,
        password: (account.password || '').trim(),
        host: account.imapHost,
        port: account.imapPort,
        useTls: account.useTls,
      });

      imap = await imaps.connect(config);
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
        const parts = (msg.parts as any[]) || [];
        const body = parts.find((p) => p.which === '')?.body;
        if (!body) continue;

        const parsed = await simpleParser(body as Source);

        // Si hay alias: valida el destinatario
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
        const labelEmail = normalizedAlias
          ? normalizedAlias
          : this.normEmail(account.email);
        return [
          `<p>❌ No hay correos recientes de <b>${platform}</b> para <b>${labelEmail}</b> en las últimas 12h.</p>`,
        ];
      }

      return [best.html];
    } catch (err: any) {
      // No ocultar errores controlados (403/400/404/etc.)
      if (err instanceof HttpException) throw err;

      console.error('❌ Error IMAP:', err);
      return ['<p>Error al filtrar correos</p>'];
    } finally {
      await this.closeImap(imap);
    }
  }
}
