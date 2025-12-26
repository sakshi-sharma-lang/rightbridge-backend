import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ApplicationsModule } from './applications/applications.module';

@Module({
  imports: [
    // ✅ Load .env globally
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    MongooseModule.forRoot('mongodb://127.0.0.1:27017/rightbridgebackend'),

    UsersModule,
    AuthModule,
    ApplicationsModule,
  ],
})
export class AppModule {}
