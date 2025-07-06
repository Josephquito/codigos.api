import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GmailToken } from './entities/gmail-token.entity';
import { Credentials } from 'google-auth-library';
import { google } from 'googleapis';

@Injectable()
export class GmailTokenService {
  constructor(
    @InjectRepository(GmailToken)
    private readonly repo: Repository<GmailToken>,
  ) {}

  async saveToken(email: string, token: Credentials): Promise<void> {
    const existing = await this.repo.findOne({ where: { email } });

    const newToken: Credentials = {
      access_token: token.access_token,
      expiry_date: token.expiry_date,
      refresh_token:
        token.refresh_token ?? (existing?.token as Credentials)?.refresh_token,

      scope: token.scope,
      token_type: token.token_type,
    };

    await this.repo.save({ email, token: newToken });
  }

  async loadToken(email: string): Promise<Credentials | null> {
    const record = await this.repo.findOne({ where: { email } });
    if (!record) return null;

    const credentials = record.token; // sin "as Credentials"
    const client = new google.auth.OAuth2(); // sin credenciales, solo para refrescar
    client.setCredentials(credentials);

    try {
      const newAccessToken = await client.getAccessToken();

      if (
        newAccessToken?.token &&
        newAccessToken.token !== credentials.access_token
      ) {
        const newToken = client.credentials;
        await this.repo.update({ email }, { token: newToken });
        console.log(`🔁 Token renovado para ${email}`);
      }
    } catch (error) {
      console.error(`❌ Error renovando token para ${email}:`, error);
    }

    return credentials;
  }
}
