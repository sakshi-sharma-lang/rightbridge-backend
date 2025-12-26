import { Type } from 'class-transformer';
import { ValidateNested, IsNotEmpty } from 'class-validator';
import { IsOptional } from 'class-validator';

import { LoanTypeDto } from './loan-type.dto';
import { ApplicantDto } from './applicant.dto';
import { PropertyDto } from './property.dto';
import { LoanRequirementsDto } from './loan-requirements.dto';
import { ExitStrategyDto } from './exit-strategy.dto';
import { SolicitorDto } from './solicitor.dto';
import { ConsentDto } from './consent.dto';

export class CreateApplicationDto {

  @ValidateNested()
  @Type(() => LoanTypeDto)
  @IsNotEmpty({ message: 'Loan type details are required' })
  loanType: LoanTypeDto;

  @ValidateNested()
  @Type(() => ApplicantDto)
  @IsNotEmpty({ message: 'Applicant details are required' })
  applicant: ApplicantDto;

  @ValidateNested()
  @Type(() => PropertyDto)
  @IsNotEmpty({ message: 'Property details are required' })
  property: PropertyDto;

  @ValidateNested()
  @Type(() => LoanRequirementsDto)
  @IsNotEmpty({ message: 'Loan requirements are required' })
  loanRequirements: LoanRequirementsDto;

  @ValidateNested()
  @Type(() => ExitStrategyDto)
  @IsNotEmpty({ message: 'Exit strategy is required' })
  exitStrategy: ExitStrategyDto;

  @ValidateNested()
  @Type(() => SolicitorDto)
  @IsNotEmpty({ message: 'Solicitor details are required' })
  solicitor: SolicitorDto;

  // ✅ optional, no validation, frontend-controlled
  @IsOptional()
  consents?: ConsentDto[];

}
