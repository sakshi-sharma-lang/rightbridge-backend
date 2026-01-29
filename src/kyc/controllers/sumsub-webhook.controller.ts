// sumsub-webhook.controller.ts
import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  Req,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { Kyc } from '../schemas/kyc.schema';
import { KycStatus } from '../enums/kyc-status.enum';

@Controller('sumsub')
export class SumsubWebhookController {
  constructor(
    @InjectModel(Kyc.name)
    private readonly kycModel: Model<Kyc>,
  ) {}

  @Post('webhook')
  async handleWebhook(
    @Req() req: any,
    @Body() body: any,
    @Headers('x-sumsub-signature') signature: string,
    @Headers('x-sumsub-timestamp') timestamp: string,
  ) {
    const rawBody = req.rawBody || JSON.stringify(body);

    // ✅ Verify webhook signature
    if (signature && timestamp) {
      this.verifySignature(rawBody, signature, timestamp);
    }

    const { applicantId, type, reviewResult } = body;

    if (!applicantId) return { ok: true };

    // ✅ Process only review events
    if (!['applicantReviewed', 'applicantPending', 'applicantOnHold'].includes(type)) {
      return { ok: true };
    }

    const kyc = await this.kycModel.findOne({ applicantId });
    if (!kyc) return { ok: true };

    // ✅ Extract KYC + AML result safely
    const kycAnswer = reviewResult?.reviewAnswer || 'PENDING';

    const amlResult =
      reviewResult?.amlCheckResult?.overallResult ||
      reviewResult?.amlCheckResult?.result ||
      'UNKNOWN';

    let status: KycStatus = KycStatus.IN_PROGRESS;

    if (kycAnswer === 'GREEN' && amlResult !== 'RED') {
      status = KycStatus.APPROVED;
    } else if (kycAnswer === 'RED' || amlResult === 'RED') {
      status = KycStatus.REJECTED;
    } else if (kycAnswer === 'YELLOW' || amlResult === 'YELLOW') {
      status = KycStatus.MANUAL_REVIEW;
    }

    // ✅ Prevent overwriting final status
    if ([KycStatus.APPROVED, KycStatus.REJECTED].includes(kyc.status)) {
      return { ok: true };
    }

    await this.kycModel.updateOne(
      { applicantId },
      {
        status,
        reviewAnswer: kycAnswer,
        amlResult,
        rawWebhookPayload: body,
        reviewedAt: new Date(),
      },
    );

    return { ok: true };
  }

  private verifySignature(rawBody: string, signature: string, timestamp: string) {
    const secret = process.env.SUMSUB_WEBHOOK_SECRET?.trim();

    if (!secret) throw new UnauthorizedException('Webhook secret missing');

    // ✅ Correct Sumsub signature payload
    const payload = timestamp + '.' + rawBody;

    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    if (expected !== signature) {
      throw new UnauthorizedException('Invalid Sumsub webhook signature');
    }
  }
}
