import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
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
import { UpdateImapAccountDto } from './dto/update-imap-account.dto';

@Controller('imap')
@UseGuards(JwtAuthGuard)
export class ImapController {
  constructor(private readonly imap: ImapService) {}

  // ============================================================
  // Accounts (User)
  // ============================================================

  /** Crea una cuenta IMAP del usuario autenticado */
  @Post('accounts')
  createAccount(@Req() req: any, @Body() dto: CreateImapAccountDto) {
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

  /** Lista mis cuentas IMAP (sin password) */
  @Get('accounts')
  listMyAccounts(@Req() req: any) {
    return this.imap.getMyAccounts(req.user.id);
  }

  /** Edita una cuenta IMAP (solo dueño) */
  @Patch('accounts/:id')
  updateAccount(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateImapAccountDto,
  ) {
    return this.imap.updateMyAccount(req.user.id, id, dto);
  }

  /** Elimina una cuenta IMAP (solo dueño) */
  @Delete('accounts/:id')
  deleteAccount(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.imap.deleteMyAccount(req.user.id, id);
  }

  /** Activa/desactiva una cuenta (solo dueño) */
  @Patch('accounts/:id/active')
  setActive(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetActiveDto,
  ) {
    return this.imap.setMyAccountActive(req.user.id, id, dto.active);
  }

  /** Marca/desmarca una cuenta como catch-all (solo dueño) */
  @Patch('accounts/:id/catchall')
  setCatchAll(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetCatchAllDto,
  ) {
    return this.imap.setMyAccountCatchAll(req.user.id, id, dto.isCatchAll);
  }

  // ============================================================
  // Reading emails
  // ============================================================

  /**
   * Lee desde catch-all por dominio del aliasEmail.
   * Frontend debe enviar aliasEmail con dominio: lalo@dominio.com
   */
  @Get('catchall/:aliasEmail/:platform')
  readFromCatchAll(
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

  /** Lee desde una cuenta específica (del usuario) por plataforma */
  @Get('account/:email/:platform')
  readFromAccount(
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
