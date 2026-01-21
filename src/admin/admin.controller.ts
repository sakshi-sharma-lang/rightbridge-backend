import {
  Controller,
  Post,
  Body,
  Param,
  Query,
  Get,
  UseGuards,
  Patch,
  Req,
  Put,
} from '@nestjs/common';

import { AdminService } from './admin.service';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';

import {
  RegisterAdminDto,
  LoginAdminDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  UpdateAdminProfileDto,
  ChangePasswordDto,
} from './dto';

// import {
//   RegisterAdminDto,
//   LoginAdminDto,
//   ForgotPasswordDto,
//   ResetPasswordDto,
//   UpdateAdminProfileDto,
// } from './dto';

@Controller('admin/auth')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('register')
  register(@Body() dto: RegisterAdminDto) {
    return this.adminService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginAdminDto) {
    return this.adminService.login(dto.email, dto.password);
  }

     @Post('reset-password')
async resetPassword(
  @Query('token') token: string,
  @Body() dto: ResetPasswordDto,
) {
  return this.adminService.resetPassword(
    token,
    dto.password,

  );
}


  // @Post('reset-password/:token')
  // reset(@Param('token') token: string, @Body() dto: ResetPasswordDto) {
  //   return this.adminService.resetPassword(token, dto.password);
  // }
@UseGuards(AdminJwtGuard)
@Get('users')
getUsersForAdmin(
  @Query() query: any,
  @Req() req: any,
) {
  return this.adminService.getUsersForAdmin(query, req.user);
}

@UseGuards(AdminJwtGuard)
@Patch('users/:id')
updateUserByAdmin(
  @Param('id') id: string,
  @Body() body: any,
  @Req() req: any,
) {
  return this.adminService.updateUserByAdmin(id, body, req.user);
}


@Put('profile')
@UseGuards(AdminJwtGuard)
updateProfile(@Req() req, @Body() dto: UpdateAdminProfileDto) {
  return this.adminService.updateProfile(req.user.adminId, dto);
}


@Put('change-password')
@UseGuards(AdminJwtGuard)
changePassword(
  @Req() req,
  @Body() dto: ChangePasswordDto,
) {
  return this.adminService.changePassword(
    req.user.adminId, // from JWT
    dto,
  );
}




}
