import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { MailService } from '../mail/mail.service';
import { ApplicationsService } from '../applications/applications.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService, // ✅ inject mail service
    private readonly applicationsService: ApplicationsService,
  ) {}

  // ===================== LOGIN =====================
  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { password: _pwd, ...result } = user.toObject();
    return result;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user._id };

    await this.usersService.updateLastLogin(user._id);

    const application =
      await this.applicationsService.findApplicationByUserId(user._id);

    const allowedStatuses = ['active', 'dip_stage'];

    return {
      access_token: this.jwtService.sign(payload),
      user,
      applicationId:
        application && allowedStatuses.includes((application as any).status)
          ? application._id
          : null,
    };
  }

  // ===================== FORGOT PASSWORD =====================
  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new BadRequestException('Email not registered');
    }

    // Generate token
    const resetToken = crypto.randomBytes(32).toString('hex');

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    // Create reset link
    const resetLink = `${process.env.FRONTEND_URL}reset-password?token=${resetToken}`;

    // ✅ JUST CALL TEMPLATE (NO HTML HERE)
    await this.mailService.sendForgotPasswordEmail(
      user.email,
      resetLink,
    );

    return {
      message: 'Password reset email sent successfully',
    };
  }

  // ===================== RESET PASSWORD =====================
  async resetPassword(token: string, newPassword: string) {
    const user = await this.usersService.findByResetToken(token);

    if (
      !user ||
      !user.resetPasswordExpires ||
      user.resetPasswordExpires < new Date()
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    return { message: 'Password reset successful' };
  }
  
 async verifyOtp(userId: string, otp: string) {
  const user = await this.usersService.findById(userId);

  // ✅ REQUIRED null check
  if (!user) {
    throw new UnauthorizedException('User not found');
  }

  // ✅ Safe to access now
  const email = user.email;
  const fullName = `${user.firstName} ${user.lastName}`;

  if (user.isOtpVerified) {
    throw new BadRequestException('OTP already verified');
  }

  if (!user.otp || !user.otpExpiresAt) {
    throw new BadRequestException('OTP not found');
  }

  if (user.otp !== otp) {
    throw new BadRequestException('Invalid OTP');
  }

  if (user.otpExpiresAt < new Date()) {
    throw new BadRequestException('OTP expired');
  }

  await this.usersService.update(userId, {
    isOtpVerified: true,
    status: 'active',
    otp: null,
    otpExpiresAt: null,
  });

  await this.mailService.sendWelcomeEmail(
    user.email,
    user.firstName,
  );

  return {
    message: 'OTP verified successfully. Account activated.',
  };
}



}
