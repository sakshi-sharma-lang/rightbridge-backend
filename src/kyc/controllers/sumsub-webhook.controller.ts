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

    // ================= LOG FULL WEBHOOK =================
    console.log('================ SUMSUB WEBHOOK RECEIVED ================');
    console.log(JSON.stringify(body, null, 2));
    console.log('Signature:', signature);
    console.log('Timestamp:', timestamp);
    console.log('========================================================');

    // ================= VERIFY SIGNATURE =================
    if (signature && timestamp) {
      this.verifySignature(rawBody, signature, timestamp);
    }

    const { applicantId, type, reviewResult } = body;

    if (!applicantId) {
      console.log('❌ No applicantId in webhook');
      return { ok: true };
    }

    console.log('👤 ApplicantId:', applicantId);
    console.log('📌 Event Type:', type);

    // ================= VALID EVENTS =================
    const allowedEvents = [
      'applicantReviewed',
      'applicantPending',
      'applicantOnHold',
      'applicantWorkflowCompleted',
    ];

    if (!allowedEvents.includes(type)) {
      console.log('⚠️ Ignored event type:', type);
      return { ok: true };
    }

    // ================= FIND KYC RECORD =================
    const kyc = await this.kycModel.findOne({ applicantId });

    if (!kyc) {
      console.log('❌ KYC record not found for applicantId:', applicantId);
      return { ok: true };
    }

    console.log('📦 KYC FOUND:', kyc);

    // ================= EXTRACT KYC + AML RESULT =================
    const kycAnswer = reviewResult?.reviewAnswer || 'PENDING';

    const amlResult =
      reviewResult?.amlCheckResult?.overallResult ||
      reviewResult?.amlCheckResult?.result ||
      body?.amlCheckResult?.overallResult ||
      'UNKNOWN';

    console.log('✅ KYC ANSWER:', kycAnswer);
    console.log('✅ AML RESULT:', amlResult);

    // ================= DETERMINE STATUS =================
    let status: KycStatus = KycStatus.IN_PROGRESS;

    if (kycAnswer === 'GREEN' && amlResult !== 'RED') {
      status = KycStatus.APPROVED;
    } else if (kycAnswer === 'RED' || amlResult === 'RED') {
      status = KycStatus.REJECTED;
    } else if (kycAnswer === 'YELLOW' || amlResult === 'YELLOW') {
      status = KycStatus.MANUAL_REVIEW;
    }

    console.log('🆕 NEW STATUS:', status);
    console.log('🕐 OLD STATUS:', kyc.status);

    // ================= PREVENT WRONG OVERWRITE =================
    const finalStatuses = [KycStatus.APPROVED, KycStatus.REJECTED];

    if (finalStatuses.includes(kyc.status) && status === KycStatus.IN_PROGRESS) {
      console.log('⚠️ Skipping downgrade of final status');
      return { ok: true };
    }

    // ================= UPDATE DB =================
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

    console.log('✅ KYC STATUS UPDATED SUCCESSFULLY');

    return { ok: true };
  }

  // ================= SIGNATURE VERIFICATION =================
  private verifySignature(rawBody: string, signature: string, timestamp: string) {
    const secret = process.env.SUMSUB_WEBHOOK_SECRET?.trim();

    if (!secret) {
      console.log('❌ SUMSUB_WEBHOOK_SECRET missing');
      throw new UnauthorizedException('Webhook secret missing');
    }

    const payload = timestamp + '.' + rawBody;

    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    if (expected !== signature) {
      console.log('❌ Invalid webhook signature');
      throw new UnauthorizedException('Invalid Sumsub webhook signature');
    }

    console.log('✅ Webhook signature verified');
  }
}
