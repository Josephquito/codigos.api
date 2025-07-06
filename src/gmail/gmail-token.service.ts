import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GmailToken } from './entities/gmail-token.entity';
import { Credentials } from 'google-auth-library';

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
    return record?.token || null;
  }
}
