import {
  IsString,
  IsNumber,
  Min,
  IsEnum,
  IsOptional,
  IsArray,
  ArrayNotEmpty,
  IsMongoId,
} from 'class-validator';

export class UpdateSurveyorDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(['RICS Accredited', 'Independent', 'Other'])
  companyType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  turnaroundTime?: string;

  @IsOptional()
  @IsString()
  accreditation?: string;

  // ✅ Application IDs (optional on update)
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty({ message: 'At least one applicationId is required' })
  @IsMongoId({ each: true })
  applicationIds?: string[];
}
