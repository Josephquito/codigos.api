import { IsOptional, IsString, IsDateString } from 'class-validator';

export class UpdateCuentaDto {
  @IsOptional()
  @IsString()
  clave?: string;

  // ✅ permitir reprogramar la fecha
  @IsOptional()
  @IsDateString()
  passwordChangeAt?: string;
}
