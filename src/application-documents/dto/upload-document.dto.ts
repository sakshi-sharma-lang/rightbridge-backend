import { IsEnum, IsNotEmpty } from 'class-validator';

export class UploadDocumentDto {
  @IsNotEmpty()
  type: string;

  @IsEnum(['user', 'admin'])
  uploadedBy: 'user' | 'admin'; 
}
