import {
  Controller,
  Post,
  Headers,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, HydratedDocument } from 'mongoose';
import * as crypto from 'crypto';
import { Kyc } from '../schemas/kyc.schema';
import { KycStatus } from '../enums/kyc-status.enum';

@Controller('sumsub')
export class SumsubWebhookController {
  constructor(
    @InjectModel(Kyc.name)
    private readonly kycModel: Model<Kyc>,
  ) {}

  private normalizeExternalUserId(id?: string) {
    return id ? decodeURIComponent(id).trim() : null;
  }

  // -------------------------
  // SUMSUB WEBHOOK ENDPOINT
  // -------------------------
  @Post('webhook')
  async handleWebhook(
    @Req() req: any,
    @Headers('x-sumsub-signature') signature: string,
    @Headers('x-sumsub-timestamp') timestamp: string,
  ) {
    const rawBody =
      req.rawBody ||
      (req.body instanceof Buffer
        ? req.body.toString('utf8')
        : JSON.stringify(req.body));

    // 🔐 Verify webhook authenticity
    this.verifySignature(rawBody, signature, timestamp);

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return { ok: true };
    }

    const {
      type,
      applicantId,
      externalUserId,
      reviewAnswer,
      reviewStatus,
    } = payload;

    if (!applicantId) return { ok: true };

    const normalizedExternalUserId =
      this.normalizeExternalUserId(externalUserId);

    let kyc: HydratedDocument<Kyc> | null = null;

    if (normalizedExternalUserId) {
      kyc = await this.kycModel.findOne({
        externalUserId: normalizedExternalUserId,
      });
    }

    if (!kyc) {
      kyc = await this.kycModel.findOne({ applicantId });
    }

    if (!kyc) return { ok: true };

    // Ensure applicantId is saved
    if (kyc.applicantId !== applicantId) {
      await this.kycModel.updateOne(
        { _id: kyc._id },
        { applicantId },
      );
    }

    // -------------------------
    // REVIEW + AML EXTRACTION
    // -------------------------
    const finalReviewAnswer =
      reviewAnswer ||
      payload.reviewResult?.reviewAnswer ||
      'PENDING';

    const amlResult =
      payload.amlCheckResult?.overallResult ||
      payload.reviewResult?.amlCheckResult?.overallResult ||
      'UNKNOWN';

    // -------------------------
    // STATUS MAPPING
    // -------------------------
    let status: KycStatus = KycStatus.IN_PROGRESS;

    if (type === 'applicantReviewed') {
      if (finalReviewAnswer === 'GREEN' && amlResult !== 'RED') {
        status = KycStatus.APPROVED;
      } else if (finalReviewAnswer === 'RED' || amlResult === 'RED') {
        status = KycStatus.REJECTED;
      } else {
        status = KycStatus.MANUAL_REVIEW;
      }
    }

    // -------------------------
    // UPDATE PAYLOAD
    // -------------------------
    const updatePayload: any = {
      status,
      reviewAnswer: finalReviewAnswer,
      reviewStatus: reviewStatus || null,
      amlResult,
      rawWebhookPayload: payload,
    };

    if (type === 'applicantReviewed') {
      updatePayload.reviewedAt = new Date();
    }

    await this.kycModel.updateOne(
      { _id: kyc._id },
      updatePayload,
    );

    return { ok: true };
  }

  // -------------------------
  // SIGNATURE VERIFICATION
  // -------------------------
  private verifySignature(
    rawBody: string,
    signature: string,
    timestamp: string,
  ) {
    const secret = process.env.SUMSUB_WEBHOOK_SECRET?.trim();

    if (!secret) {
      throw new UnauthorizedException('Webhook secret missing');
    }

    const payload = `${timestamp}.${rawBody}`;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    if (expectedSignature !== signature) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }
}
