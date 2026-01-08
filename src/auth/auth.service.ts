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

  
 if (!user.isOtpVerified) {

  const now = new Date();
  let otp = user.otp;
  let otpExpiresAt = user.otpExpiresAt;
   const otp_expiry_time = 5;
  // 🔁 Generate new OTP only if expired or missing
  if (!otp || !otpExpiresAt || otpExpiresAt < now) {
    otp = Math.floor(1000 + Math.random() * 9000).toString();
    otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
   

    await this.usersService.update(user._id.toString(), {
      otp,
      otpExpiresAt,
    });
  }

  // 📧 Send OTP verification email
  await this.mailService.sendOtpVerificationEmail(
    user.email,
    user.firstName,
    otp,
    otp_expiry_time
  );

  // 🚫 Block login + send flag
  throw new UnauthorizedException({
    message: 'OTP verification pending. Verification email sent.',
    isOtpNotVerified: false,
    email: user.email,
  });
}



  await this.usersService.updateLastLogin(user._id);

  const application =
    await this.applicationsService.findApplicationByUserId(user._id);

  const blockedStatuses = ['decline', 'completed_stage'];

  const isBlocked =
    !application || blockedStatuses.includes(application.status);

  return {
    access_token: this.jwtService.sign(payload),

    user,

    applicationId: isBlocked ? null : application._id,
    applicationStatus: isBlocked ? null : application.status,
  };
}



  // ===================== FORGOT PASSWORD =====================
async forgotPassword(email: string) {
  const user = await this.usersService.findByEmail(email);

  if (!user) {
    throw new BadRequestException({
      statusCode: 400,
      message: 'Email is not registered',
    });
  }

  // 🔐 ALWAYS generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = resetToken;
  user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();

  const resetLink = `${process.env.FRONTEND_URL}reset-password?token=${resetToken}`;

  // 📧 1️⃣ Send reset password email
  await this.mailService.sendForgotPasswordEmail(
    user.email,
    resetLink,
  );

  // 📧 2️⃣ ALWAYS send OTP email
  const now = new Date();
  let otp = user.otp;
  let otpExpiresAt = user.otpExpiresAt;
  const otp_expiry_time = 5;

  if (!otp || !otpExpiresAt || otpExpiresAt < now) {
    otp = Math.floor(1000 + Math.random() * 9000).toString();
    otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.usersService.update(user._id.toString(), {
      otp,
      otpExpiresAt,
    });
  }

  await this.mailService.sendOtpVerificationEmail(
    user.email,
    user.firstName,
    otp,
    otp_expiry_time,
  );

  return {
    statusCode: 202,
    message: 'OTP and password reset emails sent successfully',
    email: user.email,
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
  

 async verifyOtp(email: string, otp: string) {
  const user = await this.usersService.findByEmail(email);

  if (!user) {
    throw new UnauthorizedException('User not found');
  }

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

  await this.usersService.update(user._id.toString(), {
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
