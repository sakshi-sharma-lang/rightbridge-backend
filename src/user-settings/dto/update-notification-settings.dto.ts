import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationSettingsDto {

  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  smsNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  documentReminders?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingEmails?: boolean;

}