// src/gmail/gmail.controller.ts
import { Controller, Get, Query, Param, Res } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { GmailService } from './gmail.service';
import { Response } from 'express';

@Controller()
export class GmailController {
  constructor(
    private readonly authService: AuthService,
    private readonly gmailService: GmailService,
  ) {}

  @Get('login/:email')
  login(@Param('email') email: string, @Res() res: Response) {
    const url = this.gmailService.getAuthUrl(email);
    res.redirect(url); // ✅ Redirige automáticamente a Google
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

  @Get('last/:email')
  async getLastEmail(@Param('email') email: string) {
    const html = await this.gmailService.getLastEmailHtml(email);
    return { html };
  }
}
