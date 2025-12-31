import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

import { Admin, AdminDocument } from './schemas/admin.schema';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { RegisterAdminDto } from './dto/register-admin.dto';


@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Admin.name)
    private readonly adminModel: Model<AdminDocument>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService, 
  ) {}

async register(data: RegisterAdminDto) {
  const exists = await this.adminModel.findOne({ email: data.email });
  if (exists) {
    throw new UnauthorizedException('Email already registered');
  }

  const plainPassword = this.generateRandomPassword();
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  const admin = await this.adminModel.create({
    ...data,
    password: hashedPassword,
  });

  const frontendUrl = this.configService.get<string>('FRONTEND_URL');
  const loginUrl = `${frontendUrl}/login`;

  await this.mailService.sendAdminRegistrationEmail(
    data.email,
    plainPassword,
    loginUrl,
  );

  return {
    success: true,
    message: 'Admin registered successfully. Credentials sent via email.',
    data: {
      id: admin._id,
      fullName: admin.fullName,
      email: admin.email,
      role: admin.role,
      loginUrl,
    },
  };
}


  async login(email: string, password: string) {
    const admin = await this.adminModel.findOne({ email });
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      token: this.jwtService.sign({
        id: admin._id,
        role: admin.role,
      }),
    };
  }

  async forgotPassword(email: string) {
    const admin = await this.adminModel.findOne({ email });
    if (!admin) {
      return { message: 'If email exists, reset link sent' };
    }

    const token = this.jwtService.sign(
      { id: admin._id },
      { expiresIn: '15m' },
    );

    const backendUrl = this.configService.get<string>('BACKEND_URL');

    const resetLink = `${backendUrl}/admin/auth/reset-password?token=${token}`;

    await this.mailService.sendForgotPasswordEmail(email, resetLink);

    return { message: 'Password reset email sent' };
  }

  async resetPassword(token: string, password: string) {
    const payload = this.jwtService.verify(token);

    const admin = await this.adminModel.findById(payload.id);
    if (!admin) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    admin.password = await bcrypt.hash(password, 10);
    await admin.save();

    return { message: 'Password reset successful' };
  }
  private generateRandomPassword(length: number = 10): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$!%*?&';
  let password = '';

  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return password;
}

}
