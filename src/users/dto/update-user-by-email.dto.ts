import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateUserDto {
  // 🔑 Identifier (at least one required)

  @ValidateIf(o => !o.phoneNumber)
  @IsEmail()
  email?: string;

  @ValidateIf(o => !o.email)
  @IsString()
  phoneNumber?: string;




  @IsOptional()
  @MinLength(6)
  password?: string;
}
