import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateImapAccountDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;

  @IsString()
  @MinLength(1)
  imapHost: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  imapPort?: number;

  @IsOptional()
  @IsBoolean()
  useTls?: boolean;

  @IsOptional()
  @IsBoolean()
  isCatchAll?: boolean;
}

export class SetActiveDto {
  @IsBoolean()
  active: boolean;
}

export class SetCatchAllDto {
  @IsBoolean()
  isCatchAll: boolean;
}
