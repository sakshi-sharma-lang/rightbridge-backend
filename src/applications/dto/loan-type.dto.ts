import { IsNotEmpty, IsString } from 'class-validator';

export class LoanTypeDto {

  @IsString({ message: 'Application type must be a string' })
  @IsNotEmpty({ message: 'Application type is required' })
  applicationType: string;

  @IsString({ message: 'Purpose of loan must be a string' })
  @IsNotEmpty({ message: 'Purpose of loan is required' })
  purposeOfLoan: string;

  @IsString({ message: 'Fund urgency must be a string' })
  @IsNotEmpty({ message: 'Fund urgency is required' })
  fundUrgency: string;
}
