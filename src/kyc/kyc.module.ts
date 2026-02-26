import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Kyc, KycSchema } from './schemas/kyc.schema';
import { SumsubService } from './services/sumsub.service';
import { KycController } from './controllers/kyc.controller';
import { SumsubWebhookController } from './controllers/sumsub-webhook.controller';

import { MailModule } from '../mail/mail.module';
import { Application, ApplicationSchema } from '../applications/schemas/application.schema';
import { Admin, AdminSchema } from '../admin/schemas/admin.schema'; // 🔥 ADD
import { NotificationModule } from '../notification/notification.module'; // 🔥 ADD

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Kyc.name, schema: KycSchema },
      { name: Application.name, schema: ApplicationSchema },
      { name: Admin.name, schema: AdminSchema }, // 🔥 REQUIRED
    ]),
    MailModule,
    NotificationModule, // 🔥 REQUIRED
  ],
  controllers: [KycController, SumsubWebhookController],
  providers: [SumsubService],
})
export class KycModule {}