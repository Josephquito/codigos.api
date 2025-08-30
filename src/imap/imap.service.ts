// src/imap/imap.service.ts
import { Injectable } from '@nestjs/common';
import * as imaps from 'imap-simple';
import { ImapSimple } from 'imap-simple';
import { simpleParser, ParsedMail, Source } from 'mailparser';
import { ImapAccountService } from '../imap-account/imap-account.service';
import { REMITENTES_POR_PLATAFORMA } from '../utils/remitentes-plataformas';

@Injectable()
export class ImapService {
  constructor(private readonly imapAccountService: ImapAccountService) {}

  /** Lee variable de entorno y aplica trim() para evitar espacios/saltos. */
  private env(key: string, fallback = ''): string {
    const v = process.env[key];
    return (v ?? fallback).trim();
  }

  /** Construye opciones base de conexión IMAP (por env o por credenciales pasadas). */
  private buildImapOptions(
    email?: string,
    password?: string,
  ): imaps.ImapSimpleOptions {
    const user = email ?? this.env('HOST_EMAIL');
    const pass = password ?? this.env('HOST_PASSWORD');
    const host = this.env('IMAP_HOST') || 'mail.jotavix.com';
    const port = Number(this.env('IMAP_PORT')) || 993;

    // Logs de diagnóstico (no imprimimos la clave)
    console.log('[IMAP] host=', host, 'port=', port);
    console.log('[IMAP] user=', user, 'passLen=', pass ? pass.length : 0);

    return {
      imap: {
        user,
        password: pass,
        host,
        port,
        tls: true, // TLS directo en 993
        autotls: 'always', // fuerza TLS si aplica
        authTimeout: 15000,
        tlsOptions: {
          servername: host, // SNI correcto para cert *.jotavix.com
          // rejectUnauthorized: false, // NO hace falta: tu cert es válido
        },
        // debug: (msg: string) => console.log('[IMAP-DEBUG]', msg), // habilita si necesitas traza
      },
    };
  }

  /** Config por defecto (ENV) */
  private readonly config: imaps.ImapSimpleOptions = this.buildImapOptions();

  /** Config dinámica a partir de credenciales guardadas. */
  private getDynamicConfig(
    email: string,
    password: string,
  ): imaps.ImapSimpleOptions {
    return this.buildImapOptions(email, password);
  }

  /** Cierra el box y la conexión IMAP de forma segura. */
  private async safeClose(imap?: ImapSimple) {
    if (!imap) return;
    try {
      // @ts-ignore — acceso interno para saber si hay box abierto
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

  /** Utilidad: obtiene el contenido HTML/texto “usable” del ParsedMail. */
  private getMailContent(parsed: ParsedMail): string {
    return (
      parsed.html ||
      parsed.textAsHtml ||
      parsed.text ||
      '<p>Correo sin contenido</p>'
    );
  }

  /**
   * Lee el correo más reciente (últimas 12h) para un alias y plataforma
   * usando la cuenta por defecto (ENV).
   */
  async getEmailsForAliasFromPlatform(
    alias: string,
    platform: string,
  ): Promise<string[]> {
    let imap: ImapSimple | undefined;

    try {
      imap = await imaps.connect(this.config);
      await imap.openBox('INBOX');

      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

      // Trae solo lo reciente
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

        const isAliasMatch = toAddress.includes(alias.toLowerCase());
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
          `<p>❌ No hay correos recientes de <b>${platform}</b> para el alias <b>${alias}</b> en las últimas 12h.</p>`,
        ];
      }

      const { content } = result.sort((a, b) => b.date - a.date)[0];
      return [content];
    } catch (error) {
      console.error('❌ Error filtrando correos:', error);
      return ['<p>Error al filtrar correos</p>'];
    } finally {
      await this.safeClose(imap);
    }
  }

  /**
   * Lee el correo más reciente (últimas 12h) para una cuenta registrada (DB) y plataforma.
   */
  async getEmailsFromRegisteredAccountByPlatform(
    email: string,
    platform: string,
  ): Promise<string[]> {
    const account = await this.imapAccountService.getByEmail(email);
    if (!account) {
      return [`<p>❌ No se encontró la cuenta <b>${email}</b></p>`];
    }

    let imap: ImapSimple | undefined;

    try {
      imap = await imaps.connect(
        this.getDynamicConfig(account.email, (account.password || '').trim()),
      );
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
          `<p>❌ No hay correos recientes de <b>${platform}</b> para <b>${email}</b> en las últimas 12h.</p>`,
        ];
      }

      const { content } = result.sort((a, b) => b.date - a.date)[0];
      return [content];
    } catch (error) {
      console.error('❌ Error filtrando correos dinámicamente:', error);
      return ['<p>Error al filtrar correos</p>'];
    } finally {
      await this.safeClose(imap);
    }
  }
}
