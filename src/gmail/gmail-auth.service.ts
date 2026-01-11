import { BadRequestException, Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import type { Credentials } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';

interface OAuthCredentials {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
}

function base64urlEncode(obj: any) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function base64urlDecode<T = any>(s: string): T {
  return JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));
}

type OAuthState = { userId: number; email: string };

@Injectable()
export class GmailAuthService {
  private readonly SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

  constructor(private readonly prisma: PrismaService) {}

  // =========================
  // Helpers
  // =========================

  private normalizeEmail(email: string): string {
    return (email || '').trim().toLowerCase();
  }

  private assertGmail(email: string): void {
    const e = this.normalizeEmail(email);
    if (!/@gmail\.com$/i.test(e)) {
      throw new BadRequestException('El correo debe ser @gmail.com');
    }
  }

  private parseGoogleCredentials(): OAuthCredentials {
    const raw = process.env.GOOGLE_CREDENTIALS;
    if (!raw) throw new Error('GOOGLE_CREDENTIALS no está definido');

    const credentials = JSON.parse(raw) as { web: OAuthCredentials };
    if (!credentials?.web?.client_id || !credentials?.web?.client_secret) {
      throw new Error('GOOGLE_CREDENTIALS inválido (faltan campos web.*)');
    }

    return credentials.web;
  }

  /**
   * OAuth2 client "vacío" (sin tokens seteados), útil para:
   * - generateAuthUrl
   * - revokeToken
   */
  buildOAuthClient() {
    const { client_id, client_secret, redirect_uris } =
      this.parseGoogleCredentials();

    const redirectUri = redirect_uris?.[0];
    if (!redirectUri)
      throw new Error('GOOGLE_CREDENTIALS no tiene redirect_uris[0]');

    return new google.auth.OAuth2(client_id, client_secret, redirectUri);
  }

  private getOAuthClient() {
    return this.buildOAuthClient();
  }

  // =========================
  // Public API
  // =========================

  /**
   * Si quieres que "registrado" signifique "existe en DB" (aunque esté inactive),
   * deja el select sin active. Si quieres "registrado y activo", filtra active=true.
   */
  async isEmailRegistered(userId: number, email: string): Promise<boolean> {
    const e = this.normalizeEmail(email);
    this.assertGmail(e);

    const found = await this.prisma.gmailToken.findUnique({
      where: { userId_email: { userId, email: e } },
      select: { id: true },
    });

    return !!found;
  }

  generateAuthUrl(userId: number, email: string): string {
    const e = this.normalizeEmail(email);
    this.assertGmail(e);

    const client = this.getOAuthClient();
    const state = base64urlEncode({ userId, email: e } satisfies OAuthState);

    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: this.SCOPES,
      state,
    });
  }

  async getTokenFromCode(code: string, state: string) {
    const decoded = base64urlDecode<OAuthState>(state);

    const userId = decoded?.userId;
    const email = this.normalizeEmail(decoded?.email || '');

    if (!userId || !email) {
      throw new BadRequestException('State inválido');
    }

    this.assertGmail(email);

    const client = this.getOAuthClient();
    const { tokens } = await client.getToken(code);

    await this.saveToken(userId, email, tokens);
    return { userId, email };
  }

  async saveToken(
    userId: number,
    email: string,
    token: Credentials,
  ): Promise<void> {
    const e = this.normalizeEmail(email);
    this.assertGmail(e);

    const existing = await this.prisma.gmailToken.findUnique({
      where: { userId_email: { userId, email: e } },
      select: { token: true },
    });

    const existingToken = (existing?.token ?? null) as any;

    // Mantener refresh_token previo si Google no lo entrega otra vez
    const newToken: Credentials = {
      access_token: token.access_token,
      expiry_date: token.expiry_date,
      refresh_token: token.refresh_token ?? existingToken?.refresh_token,
      scope: token.scope,
      token_type: token.token_type,
    };

    await this.prisma.gmailToken.upsert({
      where: { userId_email: { userId, email: e } },
      create: { userId, email: e, token: newToken as any, active: true },
      update: { token: newToken as any, active: true },
    });
  }

  /**
   * Retorna OAuth client con credenciales seteadas y refrescadas si aplica.
   * - Solo retorna client si token está activo y puede refrescar/usar access token.
   * - Si falla (revocado/expirado), marca active=false.
   */
  async loadClient(userId: number, email: string) {
    const e = this.normalizeEmail(email);
    this.assertGmail(e);

    const entry = await this.prisma.gmailToken.findUnique({
      where: { userId_email: { userId, email: e } },
      select: { token: true, active: true },
    });

    if (!entry || !entry.active) return null;

    const client = this.getOAuthClient();
    client.setCredentials(entry.token as any);

    try {
      // Fuerza a validar/refrescar access token si es necesario
      const newAccessToken = await client.getAccessToken();

      // Si rotó access_token, persistir credenciales actuales
      const currentAccess = (entry.token as any)?.access_token;
      if (newAccessToken?.token && newAccessToken.token !== currentAccess) {
        await this.prisma.gmailToken.update({
          where: { userId_email: { userId, email: e } },
          data: { token: client.credentials as any, active: true },
        });
      }

      return client;
    } catch {
      // Si refresh_token fue revocado o ya no sirve
      await this.prisma.gmailToken.update({
        where: { userId_email: { userId, email: e } },
        data: { active: false },
      });
      return null;
    }
  }
}
