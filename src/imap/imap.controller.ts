import { Controller, Get, Param } from '@nestjs/common';
import { ImapService } from './imap.service';

@Controller('imap')
export class ImapController {
  constructor(private readonly imapService: ImapService) {}

  @Get('last')
  async getLast(): Promise<string> {
    return this.imapService.getLastEmailHtml();
  }

  @Get('alias/:email/platform/:platform')
  async getByAliasAndPlatform(
    @Param('email') email: string,
    @Param('platform') platform: string,
  ): Promise<string[]> {
    return this.imapService.getEmailsForAliasFromPlatform(email, platform);
  }

  @Get('last/:email')
  async getLastEmailFromRegistered(@Param('email') email: string) {
    return await this.imapService.getLastEmailFromRegisteredAccount(email);
  }

  @Get('registered/:email/platform/:platform')
  getRegisteredByPlatform(
    @Param('email') email: string,
    @Param('platform') platform: string,
  ) {
    return this.imapService.getEmailsFromRegisteredAccountByPlatform(
      email,
      platform,
    );
  }
}
