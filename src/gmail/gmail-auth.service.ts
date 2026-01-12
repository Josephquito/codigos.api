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

    const parsed = JSON.parse(raw) as {
      web?: OAuthCredentials;
      installed?: OAuthCredentials;
    };

    // Acepta "web" o "installed" (por si exportaste el tipo equivocado)
    const creds = parsed.web ?? parsed.installed;
    if (!creds?.client_id || !creds?.client_secret) {
      throw new Error(
        'GOOGLE_CREDENTIALS inválido (faltan client_id/client_secret en web/installed)',
      );
    }

    return creds;
  }

  private getRedirectUriFromEnvOrCredentials(creds: OAuthCredentials): string {
    // Producción: fuerza redirect al backend público (Render)
    const baseUrl = process.env.API_BASE_URL?.replace(/\/$/, '');
    if (baseUrl) return `${baseUrl}/gmail/auth/google/callback`;

    // Local/dev: usa el primer redirect_uris del JSON
    const redirectUri = creds.redirect_uris?.[0];
    if (!redirectUri) {
      throw new Error(
        'No se pudo determinar redirectUri. Define API_BASE_URL o agrega redirect_uris[0] en GOOGLE_CREDENTIALS.',
      );
    }

    return redirectUri;
  }

  buildOAuthClient() {
    const creds = this.parseGoogleCredentials();
    const redirectUri = this.getRedirectUriFromEnvOrCredentials(creds);

    return new google.auth.OAuth2(
      creds.client_id,
      creds.client_secret,
      redirectUri,
    );
  }

  private getOAuthClient() {
    return this.buildOAuthClient();
  }

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
      const newAccessToken = await client.getAccessToken();

      const currentAccess = (entry.token as any)?.access_token;
      if (newAccessToken?.token && newAccessToken.token !== currentAccess) {
        await this.prisma.gmailToken.update({
          where: { userId_email: { userId, email: e } },
          data: { token: client.credentials as any, active: true },
        });
      }

      return client;
    } catch {
      await this.prisma.gmailToken.update({
        where: { userId_email: { userId, email: e } },
        data: { active: false },
      });
      return null;
    }
  }
}
