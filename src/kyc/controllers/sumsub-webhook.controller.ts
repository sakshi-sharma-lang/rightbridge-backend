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
    try {
      const rawBody = req.rawBody;

      // ✅ Signature verification
      this.verifySignature(rawBody, signature, timestamp);

      const { type, applicantId, reviewResult, externalUserId } = body;

      if (!applicantId) return { ok: true };

      // ✅ Handle lifecycle events (do not remove)
      if (type !== 'applicantReviewed') {
        await this.kycModel.findOneAndUpdate(
          { applicantId },
          {
            lastWebhookType: type,
            rawWebhookPayload: body,
          },
          { upsert: true },
        );
        return { ok: true };
      }

      // ===== KYC RESULT =====
      const kycAnswer = reviewResult?.reviewAnswer ?? null;

      // ===== AML RESULT =====
      const amlResult = reviewResult?.amlCheckResult?.result ?? null;
      const amlStatus = amlResult ? 'COMPLETED' : 'NOT_STARTED';

      // ===== FINAL KYC + AML DECISION ENGINE =====
      let finalStatus: KycStatus;

      if (kycAnswer === 'GREEN' && amlResult !== 'RED') {
        finalStatus = KycStatus.APPROVED;
      } 
      else if (kycAnswer === 'RED' || amlResult === 'RED') {
        finalStatus = KycStatus.REJECTED;
      }
      else if (kycAnswer === 'YELLOW' || amlResult === 'YELLOW') {
        finalStatus = KycStatus.MANUAL_REVIEW;
      }
      else {
        finalStatus = KycStatus.PENDING;
      }

      // ===== DATABASE UPDATE =====
      await this.kycModel.findOneAndUpdate(
        { applicantId },
        {
          // ✅ IMPORTANT: match your schema fields
          UserId: externalUserId ?? null,
          externalUserId: externalUserId ?? null,

          status: finalStatus,

          // KYC fields
          reviewAnswer: kycAnswer,
          reviewRejectType: reviewResult?.reviewRejectType ?? null,
          reviewComment: reviewResult?.reviewComment ?? null,
          reviewedAt: reviewResult?.reviewDate
            ? new Date(reviewResult.reviewDate)
            : new Date(),

          // AML fields
          amlStatus,
          amlResult,
          riskLevel: reviewResult?.amlCheckResult?.riskLevel ?? null,
          amlHits: Array.isArray(reviewResult?.amlCheckResult?.matchedLists)
            ? reviewResult.amlCheckResult.matchedLists
            : [],

          // Debug & audit
          lastWebhookType: type,
          rawWebhookPayload: body,
        },
        { upsert: true, new: true },
      );

      return { ok: true };
    } catch (error) {
      console.error('SUMSUB WEBHOOK ERROR:', error?.message || error);
      return { ok: true }; // ✅ Sumsub requires HTTP 200 always
    }
  }

  // 🔐 Signature verification (MANDATORY)
  private verifySignature(rawBody: string, signature: string, timestamp: string) {
    const secret = process.env.SUMSUB_WEBHOOK_SECRET!;

    if (!secret) {
      throw new UnauthorizedException('Sumsub secret not configured');
    }

    const payload = timestamp + rawBody;

    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    if (expected.length !== signature.length) {
      throw new UnauthorizedException('Invalid Sumsub signature');
    }

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature),
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid Sumsub signature');
    }
  }
}
