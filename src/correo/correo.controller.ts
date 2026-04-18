import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CorreoService } from './correo.service';

@Controller('correo')
export class CorreoController {
  constructor(private readonly correoService: CorreoService) {}

  /** Público: lectura por plataforma con clave — sin JWT */
  @Get('email/:email/platform/:platform')
  async getCorreoUnificado(
    @Param('email') email: string,
    @Param('platform') platform: string,
    @Query('clave') clave: string,
  ) {
    return this.correoService.getCorreoUnificadoPublico(email, platform, clave);
  }

  /** Privado: buzón general — últimos 5 correos */
  @Get('buzon/:email')
  @UseGuards(JwtAuthGuard)
  async getBuzonGeneral(@Req() req: any, @Param('email') email: string) {
    return this.correoService.getBuzonGeneral(req.user.id, email);
  }
}
