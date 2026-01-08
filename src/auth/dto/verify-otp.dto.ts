import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsNotEmpty({ message: 'OTP is required' })
  @IsString({ message: 'OTP must be a string' })
  @Length(4, 4, { message: 'OTP must be 4 digits' })
  otp: string;
}
