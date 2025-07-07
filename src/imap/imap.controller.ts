import { Controller, Get, Param } from '@nestjs/common';
import { ImapService } from './imap.service';

@Controller('imap')
export class ImapController {
  constructor(private readonly imapService: ImapService) {}

  @Get('alias/:email/platform/:platform')
  async getByAliasAndPlatform(
    @Param('email') email: string,
    @Param('platform') platform: string,
  ): Promise<string[]> {
    return this.imapService.getEmailsForAliasFromPlatform(email, platform);
  }

  @Get('registered/:email/platform/:platform')
  async getRegisteredByPlatform(
    @Param('email') email: string,
    @Param('platform') platform: string,
  ): Promise<string[]> {
    return this.imapService.getEmailsFromRegisteredAccountByPlatform(
      email,
      platform,
    );
  }
}
