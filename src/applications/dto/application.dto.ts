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
  status?: string;
}
