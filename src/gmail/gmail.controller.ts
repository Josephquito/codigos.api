// gmail.controller.ts
import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GmailAuthService } from './gmail-auth.service';
import { GmailService } from './gmail.service';

@Controller('gmail')
@UseGuards(JwtAuthGuard)
export class GmailController {
  constructor(
    private readonly gmailAuthService: GmailAuthService,
    private readonly gmailService: GmailService,
  ) {}

  @Get('check/:email')
  async checkIfRegistered(@Req() req: any, @Param('email') email: string) {
    const userId = req.user.id;
    const exists = await this.gmailAuthService.isEmailRegistered(userId, email);
    return { exists };
  }

  @Get('login/:email')
  async login(
    @Req() req: any,
    @Param('email') email: string,
    @Res() res: Response,
  ) {
    const userId = req.user.id;

    const alreadyExists = await this.gmailAuthService.isEmailRegistered(
      userId,
      email,
    );
    if (alreadyExists) {
      return res
        .status(400)
        .send(`❌ El correo ${email} ya está registrado para este usuario`);
    }

    const url = this.gmailAuthService.generateAuthUrl(userId, email);
    return res.redirect(url);
  }

  @Get('renew/:email')
  async renew(
    @Req() req: any,
    @Param('email') email: string,
    @Res() res: Response,
  ) {
    const userId = req.user.id;
    const url = this.gmailAuthService.generateAuthUrl(userId, email);
    return res.redirect(url);
  }

  /**
   * IMPORTANTE:
   * Este callback NO debería ir con JwtAuthGuard porque Google no te va a mandar tu JWT.
   * Solución: sacar este endpoint a un controller público o eximirlo del guard.
   *
   * Para simplificar: muévelo a un controller sin guard o usa @Public() si ya tienes esa lógica.
   */
  @Get('auth/google/callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    await this.gmailAuthService.getTokenFromCode(code, state);
    return res.send(`✅ Cuenta autorizada correctamente`);
  }

  @Get('alias/:email/platform/:platform')
  async filterGmailAliasPlatform(
    @Req() req: any,
    @Param('email') email: string,
    @Param('platform') platform: string,
  ) {
    const userId = req.user.id;
    const correos = await this.gmailService.getEmailsForAliasFromPlatform(
      userId,
      email,
      platform,
    );
    return { correos };
  }
}
