import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class LoanRequirementsDto {

  @IsNumber({}, { message: 'Loan amount must be a number' })
  loanAmount: number;

  @IsNumber({}, { message: 'Purchase price must be a number' })
  purchasePrice: number;

  @IsNumber({}, { message: 'Existing mortgage must be a number' })
  existingMortgage: number;

  @IsNumber({}, { message: 'Refurbishment cost must be a number' })
  refurbishmentCost: number;

  @IsString({ message: 'Loan term must be a string' })
  @IsNotEmpty({ message: 'Loan term is required' })
  loanTerm: string;

  @IsString({ message: 'Interest payment must be a string' })
  @IsNotEmpty({ message: 'Interest payment is required' })
  interestPayment: string;
}
