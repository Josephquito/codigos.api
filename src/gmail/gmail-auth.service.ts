// gmail-auth.service.ts
import { Injectable } from '@nestjs/common';
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

  private getOAuthClient() {
    const raw = process.env.GOOGLE_CREDENTIALS;
    if (!raw) throw new Error('GOOGLE_CREDENTIALS no está definido');

    const credentials = JSON.parse(raw) as { web: OAuthCredentials };
    const { client_id, client_secret, redirect_uris } = credentials.web;

    return new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  }

  async isEmailRegistered(userId: number, email: string): Promise<boolean> {
    const found = await this.prisma.gmailToken.findUnique({
      where: { userId_email: { userId, email } },
      select: { id: true },
    });
    return !!found;
  }

  generateAuthUrl(userId: number, email: string): string {
    const client = this.getOAuthClient();

    const state = base64urlEncode({ userId, email } satisfies OAuthState);

    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: this.SCOPES,
      state,
    });
  }

  async getTokenFromCode(code: string, state: string) {
    const { userId, email } = base64urlDecode<OAuthState>(state);

    const client = this.getOAuthClient();
    const { tokens } = await client.getToken(code);

    await this.saveToken(userId, email, tokens);
    return { userId, email, tokens };
  }

  async saveToken(
    userId: number,
    email: string,
    token: Credentials,
  ): Promise<void> {
    const existing = await this.prisma.gmailToken.findUnique({
      where: { userId_email: { userId, email } },
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
      where: { userId_email: { userId, email } },
      create: { userId, email, token: newToken as any, active: true },
      update: { token: newToken as any, active: true },
    });
  }

  /**
   * Retorna OAuth client con credenciales seteadas y refrescadas si aplica.
   */
  async loadClient(userId: number, email: string) {
    const entry = await this.prisma.gmailToken.findUnique({
      where: { userId_email: { userId, email } },
      select: { token: true },
    });

    if (!entry) return null;

    const client = this.getOAuthClient();
    client.setCredentials(entry.token as any);

    try {
      const newAccessToken = await client.getAccessToken();

      // Si rotó access_token, persistir
      const currentAccess = (entry.token as any)?.access_token;
      if (newAccessToken?.token && newAccessToken.token !== currentAccess) {
        await this.prisma.gmailToken.update({
          where: { userId_email: { userId, email } },
          data: { token: client.credentials as any },
        });
      }

      return client;
    } catch (err) {
      // si refresh_token expiró/revocado, aquí te conviene marcar inactive
      await this.prisma.gmailToken.update({
        where: { userId_email: { userId, email } },
        data: { active: false },
      });
      return null;
    }
  }
}
