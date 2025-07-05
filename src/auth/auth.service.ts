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
export class AuthService {
  private SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

  constructor(
    @InjectRepository(GmailToken)
    private readonly tokenRepo: Repository<GmailToken>,
  ) {}

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
    await this.tokenRepo.save({ email, token }); // ✅ campo correcto
  }

  async loadToken(email: string) {
    const entry = await this.tokenRepo.findOne({ where: { email } });
    if (!entry) return null;

    const client = this.getOAuthClient();
    client.setCredentials(entry.token as Credentials); // ✅ CORRECTO: entry.token, no entry.tokens
    return client;
  }
}
