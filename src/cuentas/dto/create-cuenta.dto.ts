import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class CreateCuentaDto {
  @IsString()
  @IsNotEmpty()
  emailAlias: string;

  @IsString()
  @IsNotEmpty()
  plataforma: string;

  @IsString()
  @IsNotEmpty()
  clave: string;

  // ✅ fecha programada para cambio (YYYY-MM-DD o ISO)
  @IsOptional()
  @IsDateString()
  passwordChangeAt?: string;
}
