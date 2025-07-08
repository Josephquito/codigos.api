import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Credentials } from 'google-auth-library';
import { GmailToken } from '../gmail/entities/gmail-token.entity';

interface OAuthCredentials {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
}

@Injectable()
export class GmailAuthService {
  private SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

  constructor(
    @InjectRepository(GmailToken)
    private readonly tokenRepo: Repository<GmailToken>,
  ) {}

  async isEmailRegistered(email: string): Promise<boolean> {
    return await this.tokenRepo.exist({ where: { email } });
  }

  getOAuthClient() {
    const raw = process.env.GOOGLE_CREDENTIALS;
    if (!raw) throw new Error('GOOGLE_CREDENTIALS no está definido');
    const credentials = JSON.parse(raw) as { web: OAuthCredentials };
    const { client_id, client_secret, redirect_uris } = credentials.web;
    return new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  }

  generateAuthUrl(email: string): string {
    const client = this.getOAuthClient();
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: this.SCOPES,
      state: email,
    });
  }

  async getTokenFromCode(code: string, email: string) {
    const client = this.getOAuthClient();
    const { tokens } = await client.getToken(code);
    await this.saveToken(email, tokens);
    return tokens;
  }

  async saveToken(email: string, token: Credentials): Promise<void> {
    const existing = await this.tokenRepo.findOne({ where: { email } });

    const newToken: Credentials = {
      access_token: token.access_token,
      expiry_date: token.expiry_date,
      refresh_token:
        token.refresh_token ?? (existing?.token as Credentials)?.refresh_token,

      scope: token.scope,
      token_type: token.token_type,
    };

    await this.tokenRepo.save({ email, token: newToken });
  }

  async loadToken(email: string) {
    const entry = await this.tokenRepo.findOne({ where: { email } });
    if (!entry) return null;

    const client = this.getOAuthClient();
    client.setCredentials(entry.token);

    try {
      // Forzar renovación si es necesario
      const newAccessToken = await client.getAccessToken();

      // Verifica si se generó uno nuevo
      if (
        newAccessToken?.token &&
        newAccessToken.token !== entry.token['access_token']
      ) {
        // Guardar el nuevo token
        const newToken = client.credentials;
        await this.tokenRepo.update({ email }, { token: newToken });
        console.log(`🔁 Token renovado para ${email}`);
      }

      return client;
    } catch (error) {
      console.error(`❌ Error renovando token para ${email}:`, error);
      return null;
    }
  }
}
