import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ApplicationsModule } from '../applications/applications.module';


import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { AdminJwtStrategy } from './admin-jwt.strategy';

import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { Admin, AdminSchema } from '../admin/schemas/admin.schema';


@Module({
  imports: [
    UsersModule,
    MailModule,
    ApplicationsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
     MongooseModule.forFeature([
      { name: Admin.name, schema: AdminSchema },
    ]),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy,AdminJwtStrategy,],
  exports: [PassportModule],
})
export class AuthModule {}
