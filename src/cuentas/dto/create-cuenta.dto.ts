// cuentas/dto/create-cuenta.dto.ts
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCuentaDto {
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase())
  emailAlias: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Transform(({ value }) => value?.toLowerCase())
  plataforma: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  clave: string;
}
