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

  async getCorreoUnificadoPublico(
    email: string,
    platform: string,
    clave: string,
  ): Promise<string[]> {
    const emailAlias = email.trim().toLowerCase();
    const plat = platform.trim().toLowerCase();

    // 1) Validación pública (resuelve owner)
    const acceso = await this.plataformaClaveService.validarPublico(
      emailAlias,
      plat,
      clave,
    );

    if (!acceso.ok) {
      return [`<p class="text-red-600">❌ Credenciales inválidas</p>`];
    }

    const userId = acceso.userId;

    // 2) Resolver proveedor
    const isGmail = /@gmail\.com$/i.test(emailAlias);

    // Gmail solo aplica si es gmail
    if (isGmail) {
      const hasGmail = await this.gmailService.tokenExists(userId, emailAlias);
      if (hasGmail) {
        return this.gmailService.getEmailsForAliasFromPlatform(
          userId,
          emailAlias,
          plat,
        );
      }
      return [
        `<p class="text-red-600">❌ No hay token Gmail activo para ${emailAlias}</p>`,
      ];
    }

    // 3) Si NO es gmail, prioriza IMAP account (si existe)
    const hasImap = await this.prisma.imapAccount.findFirst({
      where: { userId, email: emailAlias, active: true },
      select: { id: true },
    });

    if (hasImap) {
      return this.imapService.getEmailsFromAccountByPlatform({
        userId,
        email: emailAlias,
        platform: plat,
      });
    }

    // 4) Si no hay IMAP account, usar catchall para CUALQUIER dominio
    // (Tu controlador privado ya trabaja así)
    return this.imapService.getEmailsForAliasFromPlatform({
      userId,
      aliasEmail: emailAlias,
      platform: plat,
    });
  }
}
