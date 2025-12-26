import { IsBoolean, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class PropertyDto {

  @IsString({ message: 'Property address must be a string' })
  @IsNotEmpty({ message: 'Property address is required' })
  address: string;

  @IsString({ message: 'Postcode must be a string' })
  @IsNotEmpty({ message: 'Postcode is required' })
  postcode: string;

  @IsString({ message: 'Property type must be a string' })
  @IsNotEmpty({ message: 'Property type is required' })
  propertyType: string;

  @IsBoolean({ message: 'Already owned must be true or false' })
  alreadyOwned: boolean;

  @IsNumber({}, { message: 'Estimated value must be a number' })
  estimatedValue: number;

  @IsNumber({}, { message: 'Rental income must be a number' })
  rentalIncome: number;
}
