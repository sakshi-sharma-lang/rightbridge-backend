import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { KycStatus } from '../enums/kyc-status.enum';

@Schema({ timestamps: true })
export class Kyc extends Document {
  @Prop({ required: true, index: true })
  applicationId: string;

  @Prop({ required: true, index: true })
  externalUserId: string;

  @Prop({ required: false })
  email: string;

  @Prop()
  applicantId: string;

  @Prop()
  levelName: string;

 @Prop({ default: '' })
status: string;


  // ===== KYC =====
  @Prop() reviewAnswer: string;
  @Prop() reviewRejectType: string;
  @Prop() reviewComment: string;
  @Prop() reviewedAt: Date;

  // ===== AML =====


  @Prop({ default: '' })
  amlResult?: string;
  @Prop({ type: Array }) amlHits: any[];
  @Prop() riskLevel: string;

  // ===== KYC LIFECYCLE (ALREADY ADDED EARLIER) =====
  @Prop() kycStartedAt: Date;
  @Prop() kycSubmittedAt: Date;
  @Prop() reviewStartedAt: Date;
  @Prop() kycCompletedAt: Date;

  @Prop({ type: [String] })
  uploadedDocuments: string[];



@Prop({ default: '' })
amlStatus?: string;   

  // ===== COMPLIANCE (NEW – AS REQUESTED) =====
  @Prop()
  finalDecision: string; // APPROVED / REJECTED

  @Prop()
  decisionReason: string; // AML / KYC / MANUAL

  @Prop()
  complianceNotes: string;

  // ===== RAW DATA =====
  @Prop({ type: Object })
  rawWebhookPayload: Record<string, any>;
}

export const KycSchema = SchemaFactory.createForClass(Kyc);

// prevent duplicate applicant
KycSchema.index({ externalUserId: 1 }, { unique: true });
