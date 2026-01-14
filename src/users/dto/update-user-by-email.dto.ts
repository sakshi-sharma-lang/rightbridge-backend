import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
  IsIn,
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
  @IsIn(['FORGOT_PASSWORD'])
  type?: 'FORGOT_PASSWORD';

  @IsOptional()
  @MinLength(6)
  password?: string;
}
