import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { GmailAuthService } from './gmail-auth.service';

@Controller('gmail')
export class GmailAuthController {
  constructor(private readonly gmailAuthService: GmailAuthService) {}

  @Get('auth/google/callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    await this.gmailAuthService.getTokenFromCode(code, state);
    return res.send('✅ Cuenta autorizada correctamente');
  }
}
