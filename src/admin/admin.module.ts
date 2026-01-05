import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminJwtStrategy } from './admin-jwt.strategy';
import { AdminApplicationsController } from './admin-applications.controller';

import { Admin, AdminSchema } from './schemas/admin.schema';
import { Counter, CounterSchema } from '../applications/schemas/counter.schema';
import { MailModule } from '../mail/mail.module';
import { ApplicationsModule } from '../applications/applications.module'; 

@Module({
  imports: [
    ConfigModule,

    PassportModule.register({
      defaultStrategy: 'admin-jwt',
    }),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow('JWT_SECRET'),
      }),
    }),

    MongooseModule.forFeature([
      { name: Admin.name, schema: AdminSchema },
      { name: Counter.name, schema: CounterSchema }, 
    ]),

    MailModule,
    ApplicationsModule,
  ],
  controllers: [AdminController ,AdminApplicationsController
],
  providers: [
    AdminService,
    AdminJwtStrategy,
  ],
})
export class AdminModule {}
