import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ValuationController } from './valuation.controller';
import { ValuationService } from './valuation.service';

import { Valuation, ValuationSchema } from './schemas/valuation.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Valuation.name, schema: ValuationSchema },
      { name: Payment.name, schema: PaymentSchema }, // ← add this
    ]),
  ],
  controllers: [ValuationController],
  providers: [ValuationService],
  exports: [ValuationService],
})
export class ValuationModule {}