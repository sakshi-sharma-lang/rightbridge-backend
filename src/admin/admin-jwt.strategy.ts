import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Admin, AdminDocument } from '../admin/schemas/admin.schema';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Admin.name)
    private readonly adminModel: Model<AdminDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // 🔐 Verify ADMIN from admin table
    console.log('🟡 JWT PAYLOAD RECEIVED =>', payload);
    const admin = await this.adminModel.findById(payload.id);
    // console.log('🟢 ADMIN LOOKUP RESULT =>', admin ? admin._id : null);

    if (!admin) {
      throw new UnauthorizedException('Invalid admin token');
    }

    return {
      adminId: admin._id,
      email: admin.email,
      role: admin.role,
    };
  }
}
