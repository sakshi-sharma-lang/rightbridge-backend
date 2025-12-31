import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  Matches,
} from 'class-validator';

export class RegisterAdminDto {
  @IsNotEmpty({ message: 'Full name is required' })
  fullName: string;

  @IsEmail({}, { message: 'Please enter a valid email address' })
  email: string;


  @IsNotEmpty({ message: 'Role is required' })
  role: string;
}
