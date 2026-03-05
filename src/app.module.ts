import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
 
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ApplicationsModule } from './applications/applications.module';
import { AdminModule } from './admin/admin.module';
import { MailModule } from './mail/mail.module';
import { SurveyorsModule } from './surveyors/surveyors.module';
import { PaymentsModule } from './payments/payments.module';
import { KycModule } from './kyc/kyc.module';
import { ApplicationDocumentsModule } from './application-documents/application-documents.module'; 
import { UserSettingsModule } from './user-settings/user-settings.module';
import { ChatModule } from './chat/chat.module';
import { NotificationModule } from './notification/notification.module';


import { ScheduleModule } from '@nestjs/schedule';


@Module({
  imports: [
    // 🔹 Global config
    ConfigModule.forRoot({
      isGlobal: true,
    }),
     ScheduleModule.forRoot(),

    // 🔹 MongoDB connection
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
    }),
 
    // 🔹 JWT (global)
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
      global: true,
    }),
 
    // 🔹 Feature modules
    UsersModule,
    AuthModule,
    ApplicationsModule,
    AdminModule,
    MailModule,
    SurveyorsModule,
    PaymentsModule,  
    KycModule, 
    ApplicationDocumentsModule, 
    UserSettingsModule,   
    ChatModule,
    NotificationModule,
  ],
})
export class AppModule {}