// src/imap/imap.service.ts
import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

import * as imaps from 'imap-simple';
import { ImapSimple } from 'imap-simple';
import { simpleParser, ParsedMail, Source } from 'mailparser';

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

@Injectable()
export class ImapService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================
  // Helpers IMAP
  // =========================

  private buildImapOptions(params: {
    email: string;
    password: string;
    host: string;
    port: number;
    useTls: boolean;
  }): imaps.ImapSimpleOptions {
    const { email, password, host, port, useTls } = params;

    const cleanHost = (host || '').trim().toLowerCase();
    const cleanPort = Number(port) || 993;

    // Logs internos OK (no al user)
    console.log('[IMAP] host=', cleanHost, 'port=', cleanPort, 'tls=', useTls);
    console.log(
      '[IMAP] user=',
      email,
      'passLen=',
      password ? password.length : 0,
    );

    return {
      imap: {
        user: email,
        password,
        host: cleanHost,
        port: cleanPort,
        tls: !!useTls,
        autotls: 'always',
        authTimeout: 15000,
        tlsOptions: cleanHost ? { servername: cleanHost } : undefined,
      },
    };
  }

  private async safeClose(imap?: ImapSimple) {
    if (!imap) return;

    try {
      // @ts-ignore
      if (imap['_box']) {
        await imap.closeBox(true);
      }
    } catch (e) {
      console.error('[IMAP] Error cerrando box:', e);
    }

    try {
      imap.end();
    } catch (e) {
      console.error('[IMAP] Error finalizando conexión:', e);
    }
  }

  private getMailContent(parsed: ParsedMail): string {
    return (
      (parsed.html as string) ||
      (parsed.textAsHtml as string) ||
      (parsed.text as string) ||
      '<p>Correo sin contenido</p>'
    );
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private extractDomainFromEmail(email: string): string {
    const normalized = this.normalizeEmail(email);
    const parts = normalized.split('@');
    if (parts.length !== 2 || !parts[1]) {
      throw new BadRequestException(
        'El alias debe venir con dominio (ej: lalo@dominio.com)',
      );
    }
    return parts[1];
  }

  // =========================
  // Sección A: Gestión de cuentas (unifica ImapAccountService)
  // =========================

  /**
   * Crea una cuenta IMAP para el usuario.
   * - Permite repetir emails entre usuarios
   * - Prohíbe duplicados dentro del mismo usuario (por @@unique([userId,email]))
   * - Permite múltiples catch-all por usuario (isCatchAll=true)
   */
  async registerAccount(input: RegisterAccountInput) {
    const userId = input.userId;
    const email = this.normalizeEmail(input.email);
    const password = input.password.trim();
    const imapHost = (input.imapHost ?? '').trim();
    const imapPort = input.imapPort ?? 993;
    const useTls = input.useTls ?? true;
    const isCatchAll = input.isCatchAll ?? false;

    if (!imapHost) throw new BadRequestException('imapHost es requerido');

    try {
      const created = await this.prisma.imapAccount.create({
        data: {
          userId,
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

      return { message: `✅ Cuenta ${email} guardada`, account: created };
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException(
          `⚠️ La cuenta ${email} ya está registrada para este usuario`,
        );
      }
      throw e;
    }
  }

  /** Lista cuentas del usuario (sin password) */
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

  /** Activa/desactiva una cuenta del usuario (ownership enforced) */
  async setMyAccountActive(userId: number, accountId: number, active: boolean) {
    const account = await this.prisma.imapAccount.findFirst({
      where: { id: accountId, userId },
      select: { id: true },
    });
    if (!account) throw new NotFoundException('Cuenta no encontrada');

    return this.prisma.imapAccount.update({
      where: { id: accountId },
      data: { active },
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

  /** Cambia isCatchAll para una cuenta del usuario (ownership enforced) */
  async setMyAccountCatchAll(
    userId: number,
    accountId: number,
    isCatchAll: boolean,
  ) {
    const account = await this.prisma.imapAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) throw new NotFoundException('Cuenta no encontrada');
    if (isCatchAll && !account.active) {
      throw new ForbiddenException(
        'La cuenta debe estar activa para marcarse como catch-all',
      );
    }

    return this.prisma.imapAccount.update({
      where: { id: accountId },
      data: { isCatchAll },
      select: {
        id: true,
        email: true,
        active: true,
        isCatchAll: true,
      },
    });
  }

  // =========================
  // Sección B: Resolución de credenciales (interno)
  // =========================

  private async getUserAccountCredentials(userId: number, email: string) {
    const normalizedEmail = this.normalizeEmail(email);

    const account = await this.prisma.imapAccount.findFirst({
      where: { userId, email: normalizedEmail },
    });

    if (!account) {
      throw new ForbiddenException('No tienes acceso a este correo');
    }

    if (!account.active) {
      // si prefieres no filtrar, usa el mismo mensaje:
      throw new ForbiddenException('No tienes acceso a este correo');
    }

    return account;
  }

  /**
   * Obtiene un catch-all del usuario según el dominio del alias.
   * Frontend SIEMPRE envía alias con dominio (lalo@dominio.com).
   *
   * Selección:
   * - Busca una cuenta del usuario marcada isCatchAll=true cuyo email termine en @<dominio>
   * - Si no existe: error claro
   * - Si existen varias: toma la más reciente (createdAt desc) por default
   */
  private async resolveCatchAllForAlias(userId: number, aliasEmail: string) {
    const domain = this.extractDomainFromEmail(aliasEmail);

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
        `❌ No tienes un catch-all activo para el dominio ${domain}. Marca como catch-all una cuenta de ese dominio.`,
      );
    }

    return catchAll;
  }

  // =========================
  // Sección C: Lectura IMAP (unifica tus 2 métodos)
  // =========================

  /**
   * Catch-all (por dominio): lee el correo más reciente (últimas 12h) para un alias + plataforma.
   * - alias debe venir con dominio (ej: lalo@dominio.com)
   */
  async getEmailsForAliasFromPlatform(params: {
    userId: number;
    aliasEmail: string;
    platform: string;
  }): Promise<string[]> {
    const { userId, aliasEmail, platform } = params;

    let imap: ImapSimple | undefined;

    try {
      const catchAll = await this.resolveCatchAllForAlias(userId, aliasEmail);

      const config = this.buildImapOptions({
        email: catchAll.email,
        password: (catchAll.password || '').trim(),
        host: catchAll.imapHost,
        port: catchAll.imapPort,
        useTls: catchAll.useTls,
      });

      imap = await imaps.connect(config);
      await imap.openBox('INBOX');

      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

      const messages = await imap.search([['SINCE', twelveHoursAgo]], {
        bodies: [''],
        markSeen: false,
      });

      const result: { content: string; date: number }[] = [];
      const platformLower = platform.toLowerCase();
      const posibles = REMITENTES_POR_PLATAFORMA[platformLower] || [];

      for (const msg of messages) {
        const parts = (msg.parts as any[]) || [];
        const bodyPart = parts.find((p) => p.which === '');
        if (!bodyPart) continue;

        const parsed: ParsedMail = await simpleParser(bodyPart.body as Source);

        // To: puede venir en distintos formatos, manejamos ambos
        let toAddress = '';
        try {
          if (Array.isArray(parsed.to)) {
            toAddress = (parsed.to[0] as any)?.address?.toLowerCase?.() || '';
          } else if (parsed.to && 'value' in parsed.to) {
            toAddress =
              (parsed.to as any).value?.[0]?.address?.toLowerCase?.() || '';
          }
        } catch {}

        const fromText = parsed.from?.text?.toLowerCase?.() || '';
        const fromAddress =
          parsed.from?.value?.[0]?.address?.toLowerCase?.() || '';
        const receivedDate = parsed.date?.getTime?.() || 0;

        const isAliasMatch = toAddress.includes(
          this.normalizeEmail(aliasEmail),
        );
        const isRemitenteMatch = posibles.some(
          (rem) => fromText.includes(rem) || fromAddress.includes(rem),
        );

        if (
          isAliasMatch &&
          isRemitenteMatch &&
          receivedDate > twelveHoursAgo.getTime()
        ) {
          result.push({
            content: this.getMailContent(parsed),
            date: receivedDate,
          });
        }
      }

      if (!result.length) {
        return [
          `<p>❌ No hay correos recientes de <b>${platform}</b> para el alias <b>${aliasEmail}</b> en las últimas 12h.</p>`,
        ];
      }

      const { content } = result.sort((a, b) => b.date - a.date)[0];
      return [content];
    } catch (error: any) {
      // 👇 NO tapes errores controlados (403/400/404/etc)
      if (error instanceof HttpException) throw error;

      console.error(
        '❌ Error filtrando correos (catch-all por dominio):',
        error,
      );
      return ['<p>Error al filtrar correos</p>'];
    } finally {
      await this.safeClose(imap);
    }
  }

  /**
   * Cuenta registrada (por usuario): lee el correo más reciente (últimas 12h) por plataforma.
   * - Aquí NO usamos alias, solo plataforma.
   */
  async getEmailsFromAccountByPlatform(params: {
    userId: number;
    email: string;
    platform: string;
  }): Promise<string[]> {
    const { userId, email, platform } = params;

    let imap: ImapSimple | undefined;

    try {
      const account = await this.getUserAccountCredentials(userId, email);

      const config = this.buildImapOptions({
        email: account.email,
        password: (account.password || '').trim(),
        host: account.imapHost,
        port: account.imapPort,
        useTls: account.useTls,
      });

      imap = await imaps.connect(config);
      await imap.openBox('INBOX');

      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

      const messages = await imap.search([['SINCE', twelveHoursAgo]], {
        bodies: [''],
        markSeen: false,
      });

      const result: { content: string; date: number }[] = [];
      const platformLower = platform.toLowerCase();
      const posibles = REMITENTES_POR_PLATAFORMA[platformLower] || [];

      for (const msg of messages) {
        const parts = (msg.parts as any[]) || [];
        const bodyPart = parts.find((p) => p.which === '');
        if (!bodyPart) continue;

        const parsed: ParsedMail = await simpleParser(bodyPart.body as Source);

        const fromText = parsed.from?.text?.toLowerCase?.() || '';
        const fromAddress =
          parsed.from?.value?.[0]?.address?.toLowerCase?.() || '';
        const receivedDate = parsed.date?.getTime?.() || 0;

        const isRemitenteMatch = posibles.some(
          (rem) => fromText.includes(rem) || fromAddress.includes(rem),
        );

        if (isRemitenteMatch && receivedDate > twelveHoursAgo.getTime()) {
          result.push({
            content: this.getMailContent(parsed),
            date: receivedDate,
          });
        }
      }

      if (!result.length) {
        return [
          `<p>❌ No hay correos recientes de <b>${platform}</b> para <b>${this.normalizeEmail(
            email,
          )}</b> en las últimas 12h.</p>`,
        ];
      }

      const { content } = result.sort((a, b) => b.date - a.date)[0];
      return [content];
    } catch (error: any) {
      // 👇 ESTE ES EL PUNTO CLAVE PARA QUE SALGA "No tienes acceso..."
      if (error instanceof HttpException) throw error;

      console.error('❌ Error filtrando correos (cuenta del usuario):', error);
      return ['<p>Error al filtrar correos</p>'];
    } finally {
      await this.safeClose(imap);
    }
  }
}
