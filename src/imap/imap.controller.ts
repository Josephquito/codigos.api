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

  /** Crea una cuenta IMAP (dominio propio, Outlook, catch-all) — NO Gmail */
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

  /** Buzón general: últimos 5 correos (filtra por alias si resuelve catch-all) */
  @Get('buzon/:email')
  getBuzon(@Req() req: any, @Param('email') email: string) {
    return this.imap.getLatestEmails({ userId: req.user.id, email, limit: 5 });
  }

  /** Lee correos de una plataforma para un email o alias */
  @Get('email/:email/platform/:platform')
  readEmails(
    @Req() req: any,
    @Param('email') email: string,
    @Param('platform') platform: string,
  ) {
    return this.imap.getEmailsForAlias({
      userId: req.user.id,
      email,
      platform,
    });
  }
}
