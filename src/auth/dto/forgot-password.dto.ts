import { IsEmail, IsOptional, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @IsOptional()
  @IsString()
  type?: string;
}
