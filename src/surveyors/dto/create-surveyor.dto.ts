import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsEnum,
  IsArray,
  ArrayNotEmpty,
  IsMongoId,
} from 'class-validator';

export class CreateSurveyorDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(['Rics_Accredited', 'Independent', 'Other'])
  companyType: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsNotEmpty()
  turnaroundTime: string;

  @IsString()
  @IsNotEmpty()
  accreditation: string;

  // 🔴 MANDATORY at creation time
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  applicationIds: string[];
}
