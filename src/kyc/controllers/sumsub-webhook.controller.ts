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
      // ================= RAW BODY =================
      const rawBody =
        req.rawBody ||
        (typeof body === 'string' ? body : JSON.stringify(body));

      console.log('===== SUMSUB WEBHOOK =====');
      console.log('TYPE:', body?.type);
      console.log('APPLICANT:', body?.applicantId);

      // ================= SIGNATURE VERIFY =================
      if (signature && timestamp) {
        this.verifySignature(rawBody, signature, timestamp);
      }

      const { type, applicantId, reviewResult } = body;

      if (!applicantId) {
        console.log('⚠️ applicantId missing');
        return { ok: true };
      }

      // ================= FIND KYC =================
      const existingKyc = await this.kycModel.findOne({ applicantId });

      if (!existingKyc) {
        console.warn('⚠️ KYC not found:', applicantId);
        return { ok: true };
      }

      // ================= NON-REVIEW EVENTS =================
      if (type !== 'applicantReviewed') {
        await this.kycModel.updateOne(
          { applicantId },
          {
            $set: {
              lastWebhookType: type,
              rawWebhookPayload: body,
            },
          },
        );

        return { ok: true };
      }

      // ================= REVIEW RESULT =================
      const kycAnswer = reviewResult?.reviewAnswer ?? null;

      const amlCheck = reviewResult?.amlCheckResult || {};
      const amlResult = amlCheck.result ?? null;

      let finalStatus: KycStatus = KycStatus.PENDING;

      if (kycAnswer === 'GREEN' && amlResult !== 'RED') {
        finalStatus = KycStatus.APPROVED;
      } else if (kycAnswer === 'RED' || amlResult === 'RED') {
        finalStatus = KycStatus.REJECTED;
      } else if (kycAnswer === 'YELLOW' || amlResult === 'YELLOW') {
        finalStatus = KycStatus.MANUAL_REVIEW;
      }

      console.log('✅ FINAL STATUS:', finalStatus);

      // ================= UPDATE KYC =================
      await this.kycModel.updateOne(
        { applicantId },
        {
          $set: {
            status: finalStatus,

            // ❗ keep immutable fields unchanged
            reviewAnswer: kycAnswer,
            reviewRejectType: reviewResult?.reviewRejectType ?? null,
            reviewComment: reviewResult?.reviewComment ?? null,
            reviewedAt: reviewResult?.reviewDate
              ? new Date(reviewResult.reviewDate)
              : new Date(),

            amlStatus: amlResult ? 'COMPLETED' : 'NOT_STARTED',
            amlResult,
            riskLevel: amlCheck.riskLevel ?? null,
            amlHits: Array.isArray(amlCheck.matchedLists)
              ? amlCheck.matchedLists
              : [],

            lastWebhookType: type,
            rawWebhookPayload: body,
          },
        },
      );

      console.log(
        `✅ KYC updated | app=${existingKyc.applicationId} | externalUserId=${existingKyc.externalUserId}`,
      );

      return { ok: true };
    } catch (error) {
      console.error('❌ SUMSUB WEBHOOK ERROR:', error?.message || error);
      return { ok: true }; // Sumsub requires 200 always
    }
  }

  // ================= SIGNATURE VERIFICATION =================
  private verifySignature(rawBody: string, signature: string, timestamp: string) {
    const secret = process.env.SUMSUB_WEBHOOK_SECRET;

    if (!secret) {
      throw new UnauthorizedException('Sumsub webhook secret not configured');
    }

    const payload = timestamp + rawBody;

    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');

    // ✅ Prevent crash if lengths differ
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
