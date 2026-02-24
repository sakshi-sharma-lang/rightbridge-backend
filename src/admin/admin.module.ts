import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminJwtStrategy } from './admin-jwt.strategy';
import { AdminApplicationsController } from './admin-applications.controller';
import { AdminApplicationsService } from './admin-applications.service';

import { Admin, AdminSchema } from './schemas/admin.schema';
import { Counter, CounterSchema } from '../applications/schemas/counter.schema';
import { Application, ApplicationSchema } from '../applications/schemas/application.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

import { MailModule } from '../mail/mail.module';
import { ApplicationsModule } from '../applications/applications.module';
import { InternalNotesModule } from './internal-notes/internal-notes.module';
import { NotificationModule } from '../notification/notification.module';

import { ChatModule } from '../chat/chat.module';

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
      { name: Application.name, schema: ApplicationSchema },
      { name: User.name, schema: UserSchema },
    ]),

    MailModule,
    ApplicationsModule,
    InternalNotesModule,
    NotificationModule,

    forwardRef(() => ChatModule), 
  ],

  controllers: [
    AdminController,
    AdminApplicationsController,
  ],

  providers: [
    AdminService,
    AdminApplicationsService,
    AdminJwtStrategy,
  ],

  exports: [
    AdminService,  
  ],
})
export class AdminModule {}