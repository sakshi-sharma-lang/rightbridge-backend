import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Kyc, KycSchema } from './schemas/kyc.schema';
import { SumsubService } from './services/sumsub.service';
import { KycController } from './controllers/kyc.controller';
import { SumsubWebhookController } from './controllers/sumsub-webhook.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Kyc.name, schema: KycSchema },
    ]),
  ],
  controllers: [KycController, SumsubWebhookController],
  providers: [SumsubService],
})
export class KycModule {}
