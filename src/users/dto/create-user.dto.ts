import {
  IsString,
  IsEmail,
  Matches,
  MinLength,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUserDto {
  @IsString({ message: 'First name must be a string' })
  @IsNotEmpty({ message: 'First name is required' })
  @Matches(/^[A-Za-z ]+$/, {
    message: 'First name can contain only letters',
  })
  firstName: string;

  @IsString({ message: 'Last name must be a string' })
  @IsNotEmpty({ message: 'Last name is required' })
  @Matches(/^[A-Za-z ]+$/, {
    message: 'Last name can contain only letters',
  })
  lastName: string;


  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @Matches(/^\d{10}$/, {
    message: 'Phone number must be exactly 10 digits',
  })
  phoneNumber: string;

  // ✅ OPTIONAL country code
  @IsOptional()
  @IsString({ message: 'Country code must be a string' })
  @Matches(/^\+?[1-9]\d{0,3}$/, {
    message: 'Invalid country code',
  })
  countryCode?: string;

  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{6,}$/, {
    message: 'Password must contain at least one letter and one number',
  })
  password: string;
}
