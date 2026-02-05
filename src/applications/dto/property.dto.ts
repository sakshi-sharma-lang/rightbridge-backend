import { IsBoolean, IsNotEmpty, IsNumber, IsString ,  IsOptional  ,  ValidateNested} from 'class-validator';

import { Type } from 'class-transformer';

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

  @IsString()
  ownershipStatus: string;

  //  NEW FIELD
  @IsString()
  @IsOptional()
  hasOutstandingMortgage?: string;

  //  NESTED OBJECT
  @ValidateNested()
  @Type(() => Object)
  @IsOptional()
  existingMortgageDetails?: {
    lenderName?: string;
    amountOutstanding?: number;
    paymentsUpToDate?: string;
    amountInArrears?: number;
  };
  @IsOptional()
  entityDetails?: {
  entityName?: string;
  entityType?: string;
  companyRegistrationNumber?: string;
  registeredAddress?: string;
  postcode?: string;
};
}

