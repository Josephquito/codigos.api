// cuentas/dto/update-cuenta.dto.ts
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateCuentaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  clave: string;
}
