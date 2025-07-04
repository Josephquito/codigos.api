import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';

@Module({
  providers: [AuthService],
  exports: [AuthService], // 👈 esto es CLAVE
})
export class AuthModule {}
