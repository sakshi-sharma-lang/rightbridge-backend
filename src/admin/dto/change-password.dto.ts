import { MinLength } from 'class-validator';

export class ResetPasswordDto {
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;
}
