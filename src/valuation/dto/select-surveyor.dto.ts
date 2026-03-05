import { IsMongoId, IsString, IsNumber } from 'class-validator';

export class SelectSurveyorDto {

  applicationId: string;

  surveyorId: string;

  surveyorName: string;

  companyType: string;

  price: number;

  turnaroundTime: string;

  accreditation: string;

}