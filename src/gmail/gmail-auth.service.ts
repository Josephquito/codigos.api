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

type OAuthState = { userId: number; email: string; projectId: number };

@Injectable()
export class GmailAuthService {
  private readonly SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

  // Cuántos proyectos hay disponibles (lee del env)
  private readonly PROJECT_COUNT = this.resolveProjectCount();

  constructor(private readonly prisma: PrismaService) {}

  private resolveProjectCount(): number {
    let count = 0;
    for (let i = 1; i <= 10; i++) {
      if (process.env[`GOOGLE_CREDENTIALS_${i}`]) count = i;
      else break;
    }
    return count || 1;
  }

  private normalizeEmail(email: string): string {
    return (email || '').trim().toLowerCase();
  }

  private assertGmail(email: string): void {
    if (!/@gmail\.com$/i.test(this.normalizeEmail(email))) {
      throw new BadRequestException('El correo debe ser @gmail.com');
    }
  }

  private parseCredentials(projectId: number): OAuthCredentials {
    // Intenta GOOGLE_CREDENTIALS_N, fallback a GOOGLE_CREDENTIALS (legacy)
    const raw =
      process.env[`GOOGLE_CREDENTIALS_${projectId}`] ||
      (projectId === 1 ? process.env.GOOGLE_CREDENTIALS : undefined);

    if (!raw) {
      throw new Error(`No hay credenciales para el proyecto ${projectId}`);
    }

    const parsed = JSON.parse(raw) as {
      web?: OAuthCredentials;
      installed?: OAuthCredentials;
    };

    const creds = parsed.web ?? parsed.installed;
    if (!creds?.client_id || !creds?.client_secret) {
      throw new Error(`GOOGLE_CREDENTIALS_${projectId} inválido`);
    }

    return creds;
  }

  private getRedirectUri(creds: OAuthCredentials): string {
    const baseUrl = process.env.API_BASE_URL?.replace(/\/$/, '');
    if (baseUrl) return `${baseUrl}/gmail/auth/google/callback`;
    const redirectUri = creds.redirect_uris?.[0];
    if (!redirectUri) throw new Error('No se pudo determinar redirectUri');
    return redirectUri;
  }

  buildOAuthClient(projectId = 1) {
    const creds = this.parseCredentials(projectId);
    const redirectUri = this.getRedirectUri(creds);
    return new google.auth.OAuth2(
      creds.client_id,
      creds.client_secret,
      redirectUri,
    );
  }

  // ✅ Detecta automáticamente el proyecto con menos cuentas registradas
  async resolveProjectId(userId: number): Promise<number> {
    if (this.PROJECT_COUNT <= 1) return 1;

    // Cuenta cuántos tokens hay por proyecto (global, no solo del usuario)
    const counts = await this.prisma.gmailToken.groupBy({
      by: ['googleProjectId'],
      _count: { id: true },
    });

    const countMap: Record<number, number> = {};
    for (let i = 1; i <= this.PROJECT_COUNT; i++) countMap[i] = 0;
    for (const row of counts) countMap[row.googleProjectId] = row._count.id;

    // Elige el proyecto con menos cuentas (que no haya llegado a 100)
    let best = 1;
    let bestCount = Infinity;
    for (let i = 1; i <= this.PROJECT_COUNT; i++) {
      if (countMap[i] < 100 && countMap[i] < bestCount) {
        best = i;
        bestCount = countMap[i];
      }
    }

    return best;
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

  // ✅ Genera URL OAuth — elige proyecto automáticamente
  async generateAuthUrl(userId: number, email: string): Promise<string> {
    const e = this.normalizeEmail(email);
    this.assertGmail(e);

    const projectId = await this.resolveProjectId(userId);
    const client = this.buildOAuthClient(projectId);
    const state = base64urlEncode({
      userId,
      email: e,
      projectId,
    } satisfies OAuthState);

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
    const projectId = decoded?.projectId ?? 1;

    if (!userId || !email) throw new BadRequestException('State inválido');
    this.assertGmail(email);

    const client = this.buildOAuthClient(projectId);
    const { tokens } = await client.getToken(code);

    await this.saveToken(userId, email, tokens, projectId);
    return { userId, email, projectId };
  }

  async saveToken(
    userId: number,
    email: string,
    token: Credentials,
    projectId = 1,
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
      create: {
        userId,
        email: e,
        token: newToken as any,
        active: true,
        googleProjectId: projectId,
      },
      update: { token: newToken as any, active: true },
    });
  }

  async loadClient(userId: number, email: string) {
    const e = this.normalizeEmail(email);
    this.assertGmail(e);

    const entry = await this.prisma.gmailToken.findUnique({
      where: { userId_email: { userId, email: e } },
      select: { token: true, active: true, googleProjectId: true },
    });

    if (!entry || !entry.active) return null;

    // Usa el proyecto correcto para este token
    const client = this.buildOAuthClient(entry.googleProjectId ?? 1);
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
