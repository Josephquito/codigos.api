import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateImapAccountDto {
  @IsOptional()
  @IsEmail()
  email?: string; // si quieres permitir cambiar email (ver nota abajo)

  @IsOptional()
  @IsString()
  password?: string; // si llega, se reemplaza

  @IsOptional()
  @IsString()
  imapHost?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  imapPort?: number;

  @IsOptional()
  @IsBoolean()
  useTls?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  isCatchAll?: boolean;
}
