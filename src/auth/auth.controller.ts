import { Controller, Post, Body , UseGuards , Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { AuthGuard } from '@nestjs/passport';


@Controller('auth') // prefix → /auth
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ===================== LOGIN =====================
  @Post('login') // POST /auth/login
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );

    return this.authService.login(user);
  }

  // ===================== FORGOT PASSWORD =====================
  @Post('forgot-password') // POST /auth/forgot-password
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  // ===================== RESET PASSWORD =====================
  @Post('reset-password') // POST /auth/reset-password
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

@UseGuards(AuthGuard('jwt'))
@Post('user/verify-otp')
async verifyOtp(@Req() req, @Body() dto: VerifyOtpDto) {
  return this.authService.verifyOtp(req.user.userId, dto.otp);
}


}
