import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImapAccount } from './entities/imap-account.entity';

@Injectable()
export class ImapAccountService {
  constructor(
    @InjectRepository(ImapAccount)
    private readonly repo: Repository<ImapAccount>,
  ) {}

  async register(email: string, password: string) {
    const exists = await this.repo.findOne({ where: { email } });
    if (exists) return `⚠️ La cuenta ${email} ya está registrada`;

    const cuenta = this.repo.create({ email, password });
    await this.repo.save(cuenta);
    return `✅ Cuenta ${email} guardada`;
  }

  async getAll(): Promise<ImapAccount[]> {
    return this.repo.find();
  }

  async getByEmail(email: string): Promise<ImapAccount | null> {
    return this.repo.findOne({ where: { email } });
  }
}
