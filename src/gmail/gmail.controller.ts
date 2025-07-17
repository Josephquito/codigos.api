//gmail/gmail.controller.ts
import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { GmailAuthService } from '../gmail-auth/gmail-auth.service';
import { Response } from 'express';

@Controller('gmail')
export class GmailController {
  constructor(
    private readonly gmailAuthService: GmailAuthService,
    private readonly gmailService: GmailService,
  ) {}

  @Get('check/:email')
  async checkIfRegistered(@Param('email') email: string) {
    const exists = await this.gmailAuthService.isEmailRegistered(email);
    return { exists };
  }

  @Get('login/:email')
  async login(@Param('email') email: string, @Res() res: Response) {
    const alreadyExists = await this.gmailAuthService.isEmailRegistered(email);
    if (alreadyExists) {
      return res.status(400).send(`❌ El correo ${email} ya está registrado`);
    }

    const url = this.gmailAuthService.generateAuthUrl(email);
    return res.redirect(url);
  }

  // ✅ NUEVO ENDPOINT PARA RENOVAR SIN VALIDACIÓN
  @Get('renew/:email')
  renovarToken(@Param('email') email: string, @Res() res: Response) {
    const url = this.gmailAuthService.generateAuthUrl(email);
    return res.redirect(url);
  }

  @Get('auth/google/callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') email: string,
    @Res() res: Response,
  ) {
    await this.gmailAuthService.getTokenFromCode(code, email);
    return res.send(`✅ Cuenta autorizada: ${email}`);
  }

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
