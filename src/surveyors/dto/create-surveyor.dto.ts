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

  // ✅ Correct usage (still inline, no enum file)
  @IsEnum(['Rics_Accredited', 'Independent', 'Other'], {
    message: 'companyType must be Rics_Accredited, Independent, or Other',
  })
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

  // 🔴 Mandatory + MULTIPLE allowed
  @IsArray()
  @ArrayNotEmpty({ message: 'At least one applicationId is required' })
  @IsMongoId({ each: true })
  applicationIds: string[];
}
