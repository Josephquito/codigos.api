import { Controller, Get, Param, Query } from '@nestjs/common';
import { CorreoService } from './correo.service';

@Controller('correo')
export class CorreoController {
  constructor(private readonly correoService: CorreoService) {}

  @Get('email/:email/platform/:platform')
  async getCorreoUnificado(
    @Param('email') email: string,
    @Param('platform') platform: string,
    @Query('clave') clave: string,
  ): Promise<string[]> {
    return this.correoService.getCorreoUnificado(email, platform, clave);
  }
}
