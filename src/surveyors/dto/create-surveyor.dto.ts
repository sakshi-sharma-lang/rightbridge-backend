import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsEnum,
  IsMongoId,
} from 'class-validator';

export class CreateSurveyorDto {

  @IsMongoId()
  @IsNotEmpty()
  applicationId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(['Rics_Accredited', 'Independent', 'Other'])
  companyType: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  turnaroundTime: string;

  @IsString()
  accreditation: string;
}
