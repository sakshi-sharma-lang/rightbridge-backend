import { IsString, IsNumber, Min, IsEnum, IsOptional } from 'class-validator';

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
}
