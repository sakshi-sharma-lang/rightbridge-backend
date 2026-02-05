import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApplicationStatus } from '../enums/application-status.enum';

export class ApplicationDto {
  loanType?: any;
  applicant?: any;
  property?: any;
  loanRequirements?: any;
  financialInfo?: any;
  exitStrategy?: any;
  solicitor?: any;
  additionalInfo?: any;
  consents?: { key: string; value: boolean }[];
  @IsNotEmpty({ message: 'Status is required' })
  @IsEnum(ApplicationStatus, {
    message: 'Invalid application status',
  })
  status: ApplicationStatus;
}
