import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GmailService } from '../gmail/gmail.service';
import { ImapService } from '../imap/imap.service';
import { PlataformaClaveService } from '../plataformas/plataforma-clave.service';

@Injectable()
export class CorreoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gmailService: GmailService,
    private readonly imapService: ImapService,
    private readonly plataformaClaveService: PlataformaClaveService,
  ) {}

  private normalizeAlias(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return email;
    return `${local.split('+')[0]}@${domain}`;
  }

  // ============================================================
  // Público — lectura por plataforma con clave
  // ============================================================
  async getCorreoUnificadoPublico(
    email: string,
    platform: string,
    clave: string,
  ): Promise<string[]> {
    const emailAlias = email.trim().toLowerCase();
    const plat = platform.trim().toLowerCase();

    // 1) Validar clave pública
    const acceso = await this.plataformaClaveService.validarPublico(
      emailAlias,
      plat,
      clave,
    );
    if (!acceso.ok) {
      return [`<p class="text-red-600">❌ Credenciales inválidas</p>`];
    }

    const userId = acceso.userId;
    const isGmail = /@gmail\.com$/i.test(emailAlias);

    // 2) Gmail → siempre va por GmailService (OAuth)
    if (isGmail) {
      const baseEmail = this.normalizeAlias(emailAlias);

      // Busca token en la cuenta base (cubre alias +)
      const hasToken = await this.gmailService.tokenExists(userId, baseEmail);
      if (hasToken) {
        return this.gmailService.getEmailsForAliasFromPlatform(
          userId,
          emailAlias, // alias original para filtrar To:
          plat,
        );
      }

      return [
        `<p class="text-red-600">❌ No hay token Gmail activo para ${baseEmail}</p>`,
      ];
    }

    // 3) Dominio propio / Outlook → siempre va por ImapService
    // resolveAccount dentro del service maneja cuenta exacta y catch-all
    return this.imapService.getEmailsForAlias({
      userId,
      email: emailAlias,
      platform: plat,
    });
  }

  // ============================================================
  // Privado — buzón general (últimos 5)
  // ============================================================
  async getBuzonGeneral(
    userId: number,
    email: string,
  ): Promise<{ subject: string; from: string; date: string; html: string }[]> {
    const emailNorm = email.trim().toLowerCase();
    const isGmail = /@gmail\.com$/i.test(emailNorm);

    if (isGmail) {
      const baseEmail = this.normalizeAlias(emailNorm);
      const hasToken = await this.gmailService.tokenExists(userId, baseEmail);
      if (hasToken) {
        return this.gmailService.getLatestEmails(userId, baseEmail, 5);
      }
      return [];
    }

    // Dominio propio / Outlook → IMAP (maneja catch-all automáticamente)
    return this.imapService.getLatestEmails({
      userId,
      email: emailNorm,
      limit: 5,
    });
  }
}
