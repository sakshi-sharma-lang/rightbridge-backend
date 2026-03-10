import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ValuationController } from './valuation.controller';
import { ValuationService } from './valuation.service';

import { Valuation, ValuationSchema } from './schemas/valuation.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { Counter, CounterSchema } from '../payments/schemas/counter.schema';

import { Application, ApplicationSchema } from '../applications/schemas/application.schema';
import { Surveyor, SurveyorSchema } from '../surveyors/schemas/surveyor.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Valuation.name, schema: ValuationSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Counter.name, schema: CounterSchema },

      // ✅ ADD THESE TWO
      { name: Application.name, schema: ApplicationSchema },
      { name: Surveyor.name, schema: SurveyorSchema },
    ]),
  ],
  controllers: [ValuationController],
  providers: [ValuationService],
  exports: [ValuationService],
})
export class ValuationModule {}