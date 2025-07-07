//gmail/gmail.controller.ts
import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { AuthService } from '../gmail-auth/gmail-auth.service';
import { Response } from 'express';

@Controller('gmail')
export class GmailController {
  constructor(
    private readonly authService: AuthService,
    private readonly gmailService: GmailService,
  ) {}

  @Get('login/:email')
  login(@Param('email') email: string, @Res() res: Response) {
    const url = this.gmailService.getAuthUrl(email);
    res.redirect(url);
  }

  @Get('auth/google/callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') email: string,
    @Res() res: Response,
  ) {
    await this.authService.getTokenFromCode(code, email);
    return res.send(`✅ Cuenta autorizada: ${email}`);
  }

  // ✅ Ruta nueva igual a la de IMAP
  @Get('alias/:email/platform/:platform')
  async filterGmailAliasPlatform(
    @Param('email') email: string,
    @Param('platform') platform: string,
  ) {
    const correos = await this.gmailService.getEmailsForAliasFromPlatform(
      email,
      platform,
    );
    return { correos };
  }
}
