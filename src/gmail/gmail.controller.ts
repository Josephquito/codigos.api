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
    const userId = req.user.id;
    const exists = await this.gmailAuthService.isEmailRegistered(userId, email);
    return { exists };
  }

  // ✅ 2) listar mis cuentas gmail
  @Get('accounts')
  async listMyAccounts(@Req() req: any) {
    return this.gmailService.listMyAccounts(req.user.id);
  }

  // ✅ 4) eliminar mi cuenta gmail
  @Delete('accounts/:email')
  async deleteMyAccount(@Req() req: any, @Param('email') email: string) {
    this.assertGmail(email);
    return this.gmailService.deleteMyAccount(req.user.id, email);
  }

  // ✅ URL OAuth para el front (evita 401 por redirect sin headers)
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

    const url = this.gmailAuthService.generateAuthUrl(userId, email);
    return { url };
  }

  @Get('renew-url/:email')
  async renewUrl(@Req() req: any, @Param('email') email: string) {
    this.assertGmail(email);
    const userId = req.user.id;
    const url = this.gmailAuthService.generateAuthUrl(userId, email);
    return { url };
  }

  // ✅ 5) leer por alias + plataforma
  @Get('alias/:email/platform/:platform')
  async filterGmailAliasPlatform(
    @Req() req: any,
    @Param('email') email: string,
    @Param('platform') platform: string,
  ) {
    this.assertGmail(email);
    const userId = req.user.id;
    const correos = await this.gmailService.getEmailsForAliasFromPlatform(
      userId,
      email,
      platform,
    );
    return { correos };
  }
}
