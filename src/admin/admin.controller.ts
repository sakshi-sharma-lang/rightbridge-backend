import { Controller, Post, Body, Param , Query,
  UseGuards,
  Get,} from '@nestjs/common';
import { AdminService } from './admin.service';
import {
  RegisterAdminDto,
  LoginAdminDto,
  ForgotPasswordDto,
  ResetPasswordDto, 

} from './dto';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';

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

  @Post('forgot-password')
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.adminService.forgotPassword(dto.email);
  }

  @Post('reset-password/:token')
  reset(@Param('token') token: string, @Body() dto: ResetPasswordDto) {
    return this.adminService.resetPassword(token, dto.password);
  }

  @Get('users')
@UseGuards(AdminJwtGuard)
getUsersForAdmin(@Query() query: any) {
  return this.adminService.getUsersForAdmin(query);
}

}
