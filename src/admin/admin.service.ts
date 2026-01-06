import { Injectable, UnauthorizedException ,NotFoundException,BadRequestException , ForbiddenException} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

import { Admin, AdminDocument } from './schemas/admin.schema';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { RegisterAdminDto } from './dto/register-admin.dto';
import { Counter } from '../applications/schemas/counter.schema';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Admin.name)
    private readonly adminModel: Model<AdminDocument>,
    @InjectModel(Counter.name)              
    private readonly counterModel: Model<Counter>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService, 
  ) {}
  async register(data: RegisterAdminDto) {
    const exists = await this.adminModel.findOne({ email: data.email });
    if (exists) {
      throw new UnauthorizedException('Email already registered');
    }
    const appId = await this.generateAppId();
    const plainPassword = this.generateRandomPassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const admin = await this.adminModel.create({
      ...data,
      appId,
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
        appId,
      },
    };
  }
  async login(email: string, password: string) {
    const admin = await this.adminModel.findOne({ email });
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

  admin.lastLogin = new Date();
  await admin.save();
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
  private async generateAppId(): Promise<string> {
    const counter = await this.counterModel.findOneAndUpdate(
      { name: 'admin' },          // 🔑 counter key
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    return `USR-${counter.seq.toString().padStart(3, '0')}`;
  }
  async getUsersForAdmin(query: any, jwtUser: any) {

    const {
      role,
      status,
      search,
      page = 1,
      limit = 10,
    } = query;

    const filter: any = {};
    console.log("roles",jwtUser.role)
    
      if (jwtUser.role !== 'super_admin') {
      throw new ForbiddenException('You are not allowed to view user data');
    }




    // 🔹 ROLE FILTER
    if (role) {
      filter.role = role;
    }

    // 🔹 STATUS FILTER
    if (status) {
      filter.status = status;
    }

    // 🔹 SEARCH FILTER
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { appId: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [
      users,
      total,
      totalUsers,
      activeUsers,
      adminCount,
      underwriterCount,
    ] = await Promise.all([
      // 🔹 TABLE DATA
      this.adminModel
        .find(filter)
        .select({
          appId: 1,
          fullName: 1,
          email: 1,
          role: 1,
          status: 1,
          lastLogin: 1,
        
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),

      // 🔹 FILTERED TOTAL
      this.adminModel.countDocuments(filter),

      // 🔹 DASHBOARD COUNTS
      this.adminModel.countDocuments(),
      this.adminModel.countDocuments({ status: 'active' }),
      this.adminModel.countDocuments({ role: 'admin' }),
      this.adminModel.countDocuments({ role: 'underwriter' }),
    ]);

    return {
      // 🔹 DASHBOARD CARDS
      stats: {
        totalUsers,
        activeUsers,
        admins: adminCount,
        underwriters: underwriterCount,
      },

      // 🔹 TABLE META
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
      },

      // 🔹 TABLE DATA
      data: users.map((u) => ({
         id: u._id,              // ✅ MongoDB ObjectId
        userId: u.appId,
        name: u.fullName,
        email: u.email,
        role: u.role,
        status: u.status,
      lastLogin: u.lastLogin
    ? new Date(u.lastLogin).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : 'Never',


    
      })),
    };
  }

  async updateUserByAdmin(userId: string, data: any ,  jwtUser: any) {
    // ✅ ALLOWED FIELDS
    const allowedFields = ['fullName', 'role', 'status'];

    // ❌ CHECK FOR INVALID FIELDS
    const invalidFields = Object.keys(data).filter(
      (key) => !allowedFields.includes(key),
    );

     if (jwtUser.role !== 'super_admin') {
      throw new ForbiddenException('Only super admin can update users');
    }


    if (invalidFields.length > 0) {
      throw new BadRequestException(
        `Invalid fields: ${invalidFields.join(', ')}`,
      );
    }

    const updateData: any = {};

    if (data.fullName && data.fullName.trim()) {
      updateData.fullName = data.fullName.trim();
    }

    if (data.role && data.role.trim()) {
      updateData.role = data.role;
    }

    if (data.status && data.status.trim()) {
      updateData.status = data.status;
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No valid fields provided for update');
    }

    const updatedUser = await this.adminModel.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true },
    );

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return {
      message: 'User updated successfully',
      data: updatedUser,
    };
  }

}
