import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

import { Application, ApplicationSchema } from './schemas/application.schema';
import { Counter, CounterSchema } from './schemas/counter.schema';

import { User, UserSchema } from '../users/schemas/user.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';

import { ApplicationDocument, ApplicationDocumentSchema } 
from '../application-documents/schemas/application-document.schema';

import { Kyc, KycSchema } 
from '../kyc/schemas/kyc.schema';

import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Application.name, schema: ApplicationSchema },
      { name: Counter.name, schema: CounterSchema },
      { name: User.name, schema: UserSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: ApplicationDocument.name, schema: ApplicationDocumentSchema },
      { name: Kyc.name, schema: KycSchema },
    ]),
    MailModule,
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}