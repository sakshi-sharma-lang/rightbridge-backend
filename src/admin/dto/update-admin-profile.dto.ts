import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateAdminProfileDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
