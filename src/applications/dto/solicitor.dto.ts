import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class SolicitorDto {

  @IsString({ message: 'Firm name must be a string' })
  @IsNotEmpty({ message: 'Firm name is required' })
  firmName: string;

  @IsString({ message: 'Address must be a string' })
  @IsNotEmpty({ message: 'Address is required' })
  address: string;

  @IsEmail({}, { message: 'Please enter a valid email address' })
  email: string;

  @IsString({ message: 'Contact number must be a string' })
  @IsNotEmpty({ message: 'Contact number is required' })
  contactNumber: string;

  @IsString({ message: 'Contact name must be a string' })
  @IsNotEmpty({ message: 'Contact name is required' })
  contactName: string;
}
