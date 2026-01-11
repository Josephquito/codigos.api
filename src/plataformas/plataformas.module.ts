import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlataformaClaveService } from './plataforma-clave.service';

@Module({
  imports: [PrismaModule],
  providers: [PlataformaClaveService],
  exports: [PlataformaClaveService],
})
export class PlataformasModule {}
