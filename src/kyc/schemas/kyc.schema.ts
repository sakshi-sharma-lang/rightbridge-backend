import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { KycStatus } from '../enums/kyc-status.enum';

@Schema({ timestamps: true })
export class Kyc extends Document {
  // ================= BASIC IDENTIFIERS =================
  @Prop({ required: true, index: true })
  applicationId: string;

  @Prop({ required: true, index: true })
  externalUserId: string;

  @Prop({ required: true })
  email: string;

  @Prop()
  applicantId: string;

  @Prop()
  levelName: string;

  // ================= STATUS =================
  @Prop({
    type: String,
    enum: Object.values(KycStatus),
    default: KycStatus.NOT_STARTED,
  })
  status: KycStatus;

  // ================= KYC TIMELINE (NEW) =================
  @Prop()
  kycStartedAt: Date;     // when LINK_SENT / applicantPending starts

  @Prop()
  kycCompletedAt: Date;  // when applicantReviewed (GREEN / RED)

  // ================= REVIEW (KYC) =================
  @Prop()
  reviewAnswer: string;

  @Prop()
  reviewRejectType: string;

  @Prop()
  reviewComment: string;

  @Prop()
  reviewedAt: Date;

  // ================= AML =================
  @Prop({ default: 'NOT_STARTED' })
  amlStatus: string;

  @Prop()
  amlResult: string;

  @Prop({ type: Array })
  amlHits: any[];

  @Prop()
  riskLevel: string;

  // ================= RAW WEBHOOK =================
  @Prop({ type: Object })
  rawWebhookPayload: Record<string, any>;
}

export const KycSchema = SchemaFactory.createForClass(Kyc);

// prevent duplicate applicant
KycSchema.index({ externalUserId: 1 }, { unique: true });
