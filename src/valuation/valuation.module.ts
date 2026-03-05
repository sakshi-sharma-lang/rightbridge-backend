import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ValuationController } from './valuation.controller';
import { ValuationService } from './valuation.service';

import { Valuation, ValuationSchema } from './schemas/valuation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Valuation.name, schema: ValuationSchema },
    ]),
  ],
  controllers: [ValuationController],
  providers: [ValuationService],
  exports: [ValuationService],
})
export class ValuationModule {}