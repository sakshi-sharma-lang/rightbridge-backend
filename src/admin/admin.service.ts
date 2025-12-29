import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

import { Admin, AdminDocument } from './schemas/admin.schema';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Admin.name)
    private readonly adminModel: Model<AdminDocument>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService, 
  ) {}

  async register(data: any) {
    const exists = await this.adminModel.findOne({ email: data.email });
    if (exists) {
      throw new UnauthorizedException('Email already registered');
    }

    data.password = await bcrypt.hash(data.password, 10);
    return this.adminModel.create(data);
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
}
