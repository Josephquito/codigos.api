import { Module } from '@nestjs/common';
import { CuentasService } from './cuentas.service';
import { CuentasController } from './cuentas.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformAccessKey } from 'src/correo/entities/platform-access-key.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PlatformAccessKey])],
  providers: [CuentasService],
  controllers: [CuentasController],
})
export class CuentasModule {}
