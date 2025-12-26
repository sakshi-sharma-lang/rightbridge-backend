import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class ApplicantDto {

  @IsString({ message: 'Applying as must be a string' })
  @IsNotEmpty({ message: 'Applying as is required' })
  applyingAs: string;

  @IsString({ message: 'First name must be a string' })
  @IsNotEmpty({ message: 'First name is required' })
  firstName: string;

  @IsString({ message: 'Last name must be a string' })
  @IsNotEmpty({ message: 'Last name is required' })
  lastName: string;

  @IsEmail({}, { message: 'Please enter a valid email address' })
  email: string;

  @IsString({ message: 'Mobile number must be a string' })
  @IsNotEmpty({ message: 'Mobile number is required' })
  mobile: string;

  @IsString({ message: 'Address must be a string' })
  @IsNotEmpty({ message: 'Address is required' })
  address: string;

  @IsString({ message: 'Postcode must be a string' })
  @IsNotEmpty({ message: 'Postcode is required' })
  postcode: string;

  @IsString({ message: 'Time at address must be a string' })
  @IsNotEmpty({ message: 'Time at address is required' })
  timeAtAddress: string;
}
