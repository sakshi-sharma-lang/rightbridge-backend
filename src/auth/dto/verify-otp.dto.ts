import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @Length(4, 4, { message: 'OTP must be 4 digits' })
  @IsNotEmpty({ message: 'OTP is required' })
  otp: string;
}
