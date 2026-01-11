import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ImapService } from './imap.service';
import {
  CreateImapAccountDto,
  SetActiveDto,
  SetCatchAllDto,
} from './dto/imap.dto';

@Controller('imap')
@UseGuards(JwtAuthGuard)
export class ImapController {
  constructor(private readonly imap: ImapService) {}

  // =========================
  // Accounts (User)
  // =========================

  /**
   * Crear cuenta IMAP del usuario
   */
  @Post('accounts')
  async createAccount(@Req() req: any, @Body() dto: CreateImapAccountDto) {
    return this.imap.registerAccount({
      userId: req.user.id,
      email: dto.email,
      password: dto.password,
      imapHost: dto.imapHost,
      imapPort: dto.imapPort,
      useTls: dto.useTls,
      isCatchAll: dto.isCatchAll,
    });
  }

  /**
   * Listar mis cuentas IMAP
   */
  @Get('accounts')
  async listMyAccounts(@Req() req: any) {
    return this.imap.getMyAccounts(req.user.id);
  }

  /**
   * Activar/desactivar una cuenta (solo dueño)
   */
  @Patch('accounts/:id/active')
  async setActive(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: SetActiveDto,
  ) {
    return this.imap.setMyAccountActive(req.user.id, Number(id), dto.active);
  }

  /**
   * Marcar/desmarcar cuenta como catch-all (solo dueño)
   * Nota: usuario puede tener múltiples catch-all (varios dominios)
   */
  @Patch('accounts/:id/catchall')
  async setCatchAll(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: SetCatchAllDto,
  ) {
    return this.imap.setMyAccountCatchAll(
      req.user.id,
      Number(id),
      dto.isCatchAll,
    );
  }

  // =========================
  // Reading emails
  // =========================

  /**
   * Leer desde catch-all (selección por dominio del aliasEmail)
   * Frontend SIEMPRE envía aliasEmail con dominio: lalo@dominio.com
   */
  @Get('catchall/:aliasEmail/:platform')
  async readFromCatchAll(
    @Req() req: any,
    @Param('aliasEmail') aliasEmail: string,
    @Param('platform') platform: string,
  ) {
    return this.imap.getEmailsForAliasFromPlatform({
      userId: req.user.id,
      aliasEmail,
      platform,
    });
  }

  /**
   * Leer desde una cuenta específica (del usuario) por plataforma
   */
  @Get('account/:email/:platform')
  async readFromAccount(
    @Req() req: any,
    @Param('email') email: string,
    @Param('platform') platform: string,
  ) {
    return this.imap.getEmailsFromAccountByPlatform({
      userId: req.user.id,
      email,
      platform,
    });
  }
}
