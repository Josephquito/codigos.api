import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ImapAccountService } from './imap-account.service';

@Controller('imap-accounts')
export class ImapAccountController {
  constructor(private readonly imapAccountService: ImapAccountService) {}

  @Post()
  async register(@Body() body: { email: string; password: string }) {
    return this.imapAccountService.register(body.email, body.password);
  }

  @Get()
  async getAll() {
    return this.imapAccountService.getAll();
  }

  @Get(':email')
  async getByEmail(@Param('email') email: string) {
    return this.imapAccountService.getByEmail(email);
  }
}
