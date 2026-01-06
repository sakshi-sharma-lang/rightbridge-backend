import { IsEnum, IsEmail, IsString } from 'class-validator';
import { AdminRole } from '../../common/enums/admin-role.enum';

export class CreateAdminDto {

  @IsEnum(AdminRole)
  role: AdminRole;
}
