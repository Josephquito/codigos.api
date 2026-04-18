import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
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

  private assertGmail(email: string) {
    if (!/@gmail\.com$/i.test(email)) {
      throw new BadRequestException('El correo debe ser @gmail.com');
    }
  }

  @Get('check/:email')
  async checkIfRegistered(@Req() req: any, @Param('email') email: string) {
    this.assertGmail(email);
    const exists = await this.gmailAuthService.isEmailRegistered(
      req.user.id,
      email,
    );
    return { exists };
  }

  @Get('accounts')
  async listMyAccounts(@Req() req: any) {
    return this.gmailService.listMyAccounts(req.user.id);
  }

  @Delete('accounts/:email')
  async deleteMyAccount(@Req() req: any, @Param('email') email: string) {
    this.assertGmail(email);
    return this.gmailService.deleteMyAccount(req.user.id, email);
  }

  @Get('login-url/:email')
  async loginUrl(@Req() req: any, @Param('email') email: string) {
    this.assertGmail(email);
    const userId = req.user.id;
    const alreadyExists = await this.gmailAuthService.isEmailRegistered(
      userId,
      email,
    );
    if (alreadyExists) {
      throw new BadRequestException(
        `El correo ${email} ya está registrado para este usuario`,
      );
    }
    const url = await this.gmailAuthService.generateAuthUrl(userId, email);
    return { url };
  }

  // ✅ Usa generateRenewUrl — respeta el proyecto original del token
  @Get('renew-url/:email')
  async renewUrl(@Req() req: any, @Param('email') email: string) {
    this.assertGmail(email);
    const url = await this.gmailAuthService.generateRenewUrl(
      req.user.id,
      email,
    );
    return { url };
  }

  @Get('buzon/:email')
  async getBuzon(@Req() req: any, @Param('email') email: string) {
    this.assertGmail(email);
    return this.gmailService.getLatestEmails(req.user.id, email, 5);
  }

  @Get('alias/:email/platform/:platform')
  async filterGmailAliasPlatform(
    @Req() req: any,
    @Param('email') email: string,
    @Param('platform') platform: string,
  ) {
    this.assertGmail(email);
    const correos = await this.gmailService.getEmailsForAliasFromPlatform(
      req.user.id,
      email,
      platform,
    );
    return { correos };
  }
}
