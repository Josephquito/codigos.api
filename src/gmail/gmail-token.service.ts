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
    await this.repo.save({ email, token });
  }

  async loadToken(email: string): Promise<Credentials | null> {
    const record = await this.repo.findOne({ where: { email } });
    return record?.token || null;
  }
}
