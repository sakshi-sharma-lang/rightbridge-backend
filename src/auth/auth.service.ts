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
import { ConfigService } from '@nestjs/config';


@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService, // ✅ inject mail service
    private readonly applicationsService: ApplicationsService,
    private readonly configService: ConfigService,
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

  if (!otp || !otpExpiresAt || otpExpiresAt < now) {
    otp = Math.floor(1000 + Math.random() * 9000).toString();
    otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
   

    await this.usersService.update(user._id.toString(), {
      otp,
      otpExpiresAt,
    });
  }
const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN');
const access_token = this.jwtService.sign(payload); // expiry already applied by JwtModule
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
     statusCode: 401,

  });
}

const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN');
const access_token = this.jwtService.sign(payload); // expiry already applied by JwtModule
console.log("access_token",access_token);
  await this.usersService.updateLastLogin(user._id);

  const application =
    await this.applicationsService.findApplicationByUserId(user._id);

  const blockedStatuses = ['decline', 'completed_stage','AUTO_REJECTED'];

  const isBlocked =
    !application || blockedStatuses.includes(application.status);
    


  return {
     message: 'Login successful',
      error: null,
      statusCode: 200,
    access_token: this.jwtService.sign(payload),
    expiresIn: '8h',
    user,

    applicationId: isBlocked ? null : application._id,
    applicationStatus: isBlocked ? null : application.status,
    applicationStageManagement:
    application?.application_stage_management || [],

  };
}

  // ===================== FORGOT PASSWORD =====================
  // async forgotPassword(email: string) {
  //   const user = await this.usersService.findByEmail(email);

  //   if (!user) {
  //     throw new BadRequestException('Email not registered');
  //   }

  //   // Generate token
  //   const resetToken = crypto.randomBytes(32).toString('hex');

  //   user.resetPasswordToken = resetToken;
  //   user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
  //   await user.save();

  //   // Create reset link
  //   const resetLink = `${process.env.FRONTEND_URL}reset-password?token=${resetToken}`;

  //   // ✅ JUST CALL TEMPLATE (NO HTML HERE)
  //   await this.mailService.sendForgotPasswordEmail(
  //     user.email,
  //     resetLink,
  //   );

  //   return {
  //     message: 'Password reset email sent successfully',
  //   };
  // }


async forgotPassword(email: string, type?: string) {
  const user = await this.usersService.findByEmail(email);
  if (!user) {
    throw new BadRequestException({
      statusCode: 400,
      message: 'Email is not registered',
    });
  }
  const now = new Date();
  // ================= MOBILE FLOW (OTP ONLY) =================
  if (type === 'mobile') {
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
      statusCode: 200,
      message: 'OTP sent successfully',
      email: user.email,
    };
  }

  // ================= WEB FLOW (RESET LINK ONLY) =================
  const resetToken = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = resetToken;
  user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();

  const resetLink = `${process.env.FRONTEND_URL}reset-password?token=${resetToken}`;

  await this.mailService.sendForgotPasswordEmail(user.email, resetLink);

  return {
    statusCode: 200,
    message: 'Password reset email sent successfully',
    email: user.email,
  };
}

async resetPassword(token: string, newPassword: string) {
  try {
    const user = await this.usersService.findByResetToken(token);

    if (!user) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'This reset link is no longer valid. Please generate a new one to reset your password.'
      });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    return {
      statusCode: 200,
      message: 'Password reset successful',
    };
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }

    throw new BadRequestException({
      statusCode: 500,
      message: 'Something went wrong while resetting password',
      error: error.message,
    });
  }
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

  async verifyOtpForgetPassword(email: string, otp: string , type?: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
      });
    }

    if (!user.otp || !user.otpExpiresAt) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'OTP not found',
        error: 'OTP_NOT_FOUND',
      });
    }

    if (user.otp !== otp) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Invalid OTP',
        error: 'INVALID_OTP',
      });
    }

    if (user.otpExpiresAt < new Date()) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'OTP expired',
        error: 'OTP_EXPIRED',
      });
    }

    //  Generate reset password token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);

    await this.usersService.update(user._id.toString(), {
      resetPasswordToken: resetToken,
      resetPasswordExpires,
      otp: null,
      otpExpiresAt: null,
    });

    // 🔗 Reset link
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    // 📧 Send reset password email
    if (type !== 'mobile') {
      await this.mailService.sendForgotPasswordEmail(
        user.email,
        resetLink,
      );
    }
    return {
  statusCode: 200,
  message:
    type === 'mobile'
      ? 'OTP verified. Reset token generated.'
      : 'OTP verified. Password reset link sent to email.',
  resetToken,
};
  }
}
