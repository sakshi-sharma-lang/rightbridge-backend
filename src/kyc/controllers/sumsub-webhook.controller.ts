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

    console.log('================ SUMSUB WEBHOOK RECEIVED ================');
    console.log('RAW BODY:', rawBody);

    let parsedBody: any;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      console.log('❌ JSON PARSE FAILED');
      return { ok: true };
    }

    const {
      applicantId,
      type,
      reviewResult,
      externalUserId,
      amlCheckResult,
    } = parsedBody;

    console.log('WEBHOOK TYPE:', type);
    console.log('APPLICANT ID:', applicantId);
    console.log('EXTERNAL USER ID:', externalUserId);

    if (!applicantId) {
      console.log('❌ Missing applicantId → ignored');
      return { ok: true };
    }

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

    if (!kyc) {
      console.log('❌ KYC RECORD NOT FOUND → ignored');
      return { ok: true };
    }

    if (kyc.applicantId !== applicantId) {
      console.log('ℹ️ Updating applicantId in DB');
      await this.kycModel.updateOne(
        { _id: kyc._id },
        { applicantId },
      );
    }

    /* ======================================================
       🔐 AML WEBHOOK — ALL AML CASES
       ====================================================== */
    if (type === 'amlCheckCompleted') {
      console.log('✅ AML WEBHOOK RECEIVED');
      console.log('AML CHECK RESULT:', amlCheckResult);

      const amlResult =
        amlCheckResult?.overallResult || '';

      console.log('FINAL AML RESULT:', amlResult);

      await this.kycModel.updateOne(
        { _id: kyc._id },
        {
          amlResult,
          amlStatus:
            amlResult === 'RED' ? 'FAILED' : 'PASSED',
          rawWebhookPayload: parsedBody,
          reviewedAt: new Date(),
          decisionReason:
            amlResult === 'RED' ? 'AML' : undefined,
        },
      );

      console.log('✅ AML DATA SAVED');
      return { ok: true };
    }

    /* ======================================================
       🆔 KYC WEBHOOK — ALL KYC CASES
       ====================================================== */
    if (type !== 'applicantReviewed') {
      console.log('ℹ️ Not KYC / AML webhook → ignored');
      return { ok: true };
    }

    console.log('✅ KYC REVIEW WEBHOOK RECEIVED');

    const kycAnswer = reviewResult?.reviewAnswer || 'PENDING';
    console.log('KYC REVIEW ANSWER:', kycAnswer);

    const amlResult = kyc.amlResult || 'UNKNOWN';
    console.log('CURRENT AML RESULT (DB):', amlResult);

    const uploadedDocuments =
      reviewResult?.reviewDocuments?.map(
        (doc) => doc.idDocType,
      ) || [];

    let status: KycStatus = KycStatus.IN_PROGRESS;

    if (amlResult === 'RED') {
      status = KycStatus.REJECTED;
    } else if (kycAnswer === 'GREEN') {
      status = KycStatus.APPROVED;
    } else if (kycAnswer === 'RED') {
      status = KycStatus.REJECTED;
    } else {
      status = KycStatus.MANUAL_REVIEW;
    }

    console.log('FINAL KYC STATUS:', status);

    await this.kycModel.updateOne(
      { _id: kyc._id },
      {
        status,
        reviewAnswer: kycAnswer,
        amlResult,
        rawWebhookPayload: parsedBody,
        reviewedAt: new Date(),

        uploadedDocuments,

        kycCompletedAt:
          status === KycStatus.APPROVED ||
          status === KycStatus.REJECTED
            ? new Date()
            : undefined,

        finalDecision:
          status === KycStatus.APPROVED
            ? 'APPROVED'
            : status === KycStatus.REJECTED
            ? 'REJECTED'
            : undefined,

        decisionReason:
          amlResult === 'RED'
            ? 'AML'
            : kycAnswer === 'RED'
            ? 'KYC'
            : undefined,
      },
    );

    console.log('✅ KYC DATA SAVED');
    console.log('========================================================');

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
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }
}
