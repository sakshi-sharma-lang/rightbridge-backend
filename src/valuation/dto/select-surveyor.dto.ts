import { IsMongoId, IsString, IsNumber } from 'class-validator';

export class SelectSurveyorDto {

  @IsMongoId()
  applicationId: string;

  @IsMongoId()
  surveyorId: string;

  @IsString()
  surveyorName: string;

  @IsString()
  companyType: string;

  @IsNumber()
  price: number;

  @IsString()
  turnaroundTime: string;

  @IsString()
  accreditation: string;

}