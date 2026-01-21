import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
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
  @Body() body: any,
  @Headers('x-signature') signature: string,
  @Headers('x-timestamp') timestamp: string,
) {
  try {
    console.log('================= SUMSUB WEBHOOK START =================');
    console.log('🕒 Received at:', new Date().toISOString());

    // 🔐 Verify signature
    this.verifySignature(body, signature, timestamp);
    console.log('✅ Signature verification passed');

    const { type, applicantId, reviewResult, externalUserId } = body;

    // Ignore unrelated events
    if (type !== 'applicantReviewed') {
      return { ok: true };
    }

    if (!applicantId || !reviewResult) {
      console.warn('⚠️ Invalid webhook payload');
      return { ok: true };
    }

    // ======================
    // KYC RESULT
    // ======================
    const kycAnswer = reviewResult.reviewAnswer;

    // ======================
    // AML RESULT (CRITICAL)
    // ======================
    const aml = reviewResult?.amlCheckResult;

    const amlStatus = aml ? 'COMPLETED' : 'NOT_STARTED';
    const amlResult = aml?.result ?? null; // GREEN | YELLOW | RED
    const amlHits = aml?.matchedLists ?? [];
    const riskLevel = aml?.riskLevel ?? null;

    // ======================
    // FINAL STATUS DECISION
    // ======================
    let status: KycStatus;

    if (kycAnswer === 'GREEN' && amlResult === 'GREEN') {
      status = KycStatus.APPROVED;
    } else if (kycAnswer === 'RED' || amlResult === 'RED') {
      status = KycStatus.REJECTED;
    } else {
      status = KycStatus.PENDING;
    }

    // ======================
    // UPSERT DATABASE
    // ======================
    await this.kycModel.findOneAndUpdate(
      { applicantId },
      {
        $set: {
          UserId: externalUserId ?? null,

          status,
          reviewAnswer: kycAnswer,
          reviewRejectType: reviewResult.reviewRejectType ?? null,
          reviewComment: reviewResult.reviewComment ?? null,
          reviewedAt: reviewResult.reviewDate
            ? new Date(reviewResult.reviewDate)
            : new Date(),

          // AML
          amlStatus,
          amlResult,
          amlHits,
          riskLevel,

          rawWebhookPayload: body,
        },
      },
      { upsert: true, new: true },
    );

    console.log('✅ KYC + AML processed successfully');
    console.log('================= SUMSUB WEBHOOK END =================');

    return { ok: true };
  } catch (error) {
    console.error('❌ SUMSUB WEBHOOK ERROR:', error?.message);
    return { ok: true }; // always 200 (Sumsub requirement)
  }
}



  // 🔐 Signature verification (MANDATORY)
  private verifySignature(
    body: any,
    signature: string,
    timestamp: string,
  ) {
    const secret = process.env.SUMSUB_WEBHOOK_SECRET!;
    const payload = `${timestamp}.${JSON.stringify(body)}`;

    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    if (expected !== signature) {
      throw new UnauthorizedException('Invalid Sumsub signature');
    }
  }
}
