import { Type } from 'class-transformer';
import { ValidateNested, IsNotEmpty } from 'class-validator';
import { IsOptional } from 'class-validator';

import { LoanTypeDto } from './loan-type.dto';
import { ApplicationDto } from './application.dto';
import { PropertyDto } from './property.dto';
import { LoanRequirementsDto } from './loan-requirements.dto';
import { ExitStrategyDto } from './exit-strategy.dto';
import { SolicitorDto } from './solicitor.dto';
import { ConsentDto } from './consent.dto';

export class CreateOrUpdateApplicationDto {
  loanType?: any;
  applicant?: any;
  property?: any;
  loanRequirements?: any;
  exitStrategy?: any;
  solicitor?: any;
  consents?: { key: string; value: boolean }[];
  status?: string;
}

