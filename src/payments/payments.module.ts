import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

import { Payment, PaymentSchema } from './schemas/payment.schema';
import { Application, ApplicationSchema } from '../applications/schemas/application.schema';
import { Admin, AdminSchema } from '../admin/schemas/admin.schema';

import { Counter, CounterSchema } from './schemas/counter.schema'; // ✅ add this

import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Application.name, schema: ApplicationSchema },
      { name: Admin.name, schema: AdminSchema },

      { name: Counter.name, schema: CounterSchema }, // ✅ register counter model
    ]),

    NotificationModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}