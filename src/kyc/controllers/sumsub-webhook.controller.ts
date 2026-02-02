import {
  Controller,
  Post,
  Headers,
  UnauthorizedException,
  Req,
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

    // ✅ ONLY CHANGE: verify webhook signature
    this.verifySignature(rawBody, signature, timestamp);

    let parsedBody: any;

    try {
      parsedBody = JSON.parse(rawBody);
    } catch (err) {
      console.log('❌ Failed to parse webhook body');
      return { ok: true };
    }

    const { applicantId, type, reviewResult, externalUserId } = parsedBody;

    if (!applicantId) return { ok: true };

    const normalizedExternalUserId =
      this.normalizeExternalUserId(externalUserId);

    let kyc: HydratedDocument<Kyc> | null = null;

    if (normalizedExternalUserId) {
      kyc = await this.kycModel.findOne({
        externalUserId: normalizedExternalUserId,
      });
    }

    if (!kyc && applicantId) {
      kyc = await this.kycModel.findOne({ applicantId });
    }

    if (!kyc) return { ok: true };

    if (kyc.applicantId !== applicantId) {
      await this.kycModel.updateOne(
        { _id: kyc._id },
        { applicantId },
      );
    }

    const kycAnswer = reviewResult?.reviewAnswer || 'PENDING';

    const amlResult =
      reviewResult?.amlCheckResult?.overallResult ||
      parsedBody?.amlCheckResult?.overallResult ||
      'UNKNOWN';

    let status: KycStatus = KycStatus.IN_PROGRESS;

    if (type === 'applicantReviewed') {
      if (kycAnswer === 'GREEN' && amlResult !== 'RED') {
        status = KycStatus.APPROVED;
      } else if (kycAnswer === 'RED' || amlResult === 'RED') {
        status = KycStatus.REJECTED;
      } else {
        status = KycStatus.MANUAL_REVIEW;
      }
    }

    await this.kycModel.updateOne(
      { _id: kyc._id },
      {
        status,
        reviewAnswer: kycAnswer,
        amlResult,
        rawWebhookPayload: parsedBody,
        reviewedAt: new Date(),
      },
    );

    return { ok: true };
  }

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

    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    if (expected !== signature) {
      throw new UnauthorizedException('Invalid Sumsub webhook signature');
    }
  }
}
