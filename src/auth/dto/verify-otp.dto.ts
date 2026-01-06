import { IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Length(4, 4)
  otp: string;
}
