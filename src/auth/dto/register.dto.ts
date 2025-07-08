import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { UserRole } from '../../users/user-role.enum'; // ajusta la ruta si es diferente

export class RegisterDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @Transform(({ value }: { value: string }) => value.trim())
  @IsString()
  @MinLength(6)
  password!: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}
