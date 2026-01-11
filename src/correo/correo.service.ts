// correo/correo.service.ts
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

  /**
   * Endpoint público: email + plataforma + clave
   * Devuelve correos o un mensaje genérico de credenciales inválidas.
   */
  async getCorreoUnificadoPublico(
    email: string,
    platform: string,
    clave: string,
  ): Promise<string[]> {
    const emailAlias = email.toLowerCase();
    const plat = platform.toLowerCase();

    // 1) Validación pública (resuelve owner)
    const acceso = await this.plataformaClaveService.validarPublico(
      emailAlias,
      plat,
      clave,
    );

    // Importante: mensaje genérico para no filtrar existencia
    if (!acceso.ok) {
      return [`<p class="text-red-600">❌ Credenciales inválidas</p>`];
    }

    const userId = acceso.userId;

    // 2) Resolver proveedor
    const isGmail = emailAlias.endsWith('@gmail.com');
    const isCatchAll = emailAlias.endsWith('@jotavix.com');

    // Gmail habilitado (token existe para ese user y ese email)
    const hasGmail = await this.gmailService.tokenExists(userId, emailAlias);

    // IMAP registrado para ese user y ese email
    const hasImap = await this.prisma.imapAccount.findFirst({
      where: { userId, email: emailAlias, active: true },
      select: { id: true },
    });

    if (isGmail && hasGmail) {
      return this.gmailService.getEmailsForAliasFromPlatform(
        userId,
        emailAlias,
        plat,
      );
    }

    if (hasImap) {
      // Cuenta IMAP específica del usuario
      return this.imapService.getEmailsFromAccountByPlatform({
        userId,
        email: emailAlias,
        platform: plat,
      });
    }

    if (isCatchAll) {
      // Catch-all por dominio (usa aliasEmail)
      return this.imapService.getEmailsForAliasFromPlatform({
        userId,
        aliasEmail: emailAlias,
        platform: plat,
      });
    }

    return [
      `<p class="text-red-600">❌ No hay proveedor configurado para este alias</p>`,
    ];
  }
}
