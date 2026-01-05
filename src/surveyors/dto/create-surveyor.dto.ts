import { IsString, IsNotEmpty, IsNumber, Min, IsEnum } from 'class-validator';

export class CreateSurveyorDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(['RICS Accredited', 'Independent', 'Other'])
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
}
