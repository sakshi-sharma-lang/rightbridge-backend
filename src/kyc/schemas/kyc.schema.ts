@Schema({ timestamps: true })
export class Kyc extends Document {

  @Prop({ required: true, index: true })
  UserId: string;

  @Prop({ required: true, unique: true })
  applicantId: string;

  @Prop({ required: true })
  levelName: string;

  @Prop({
    type: String,
    enum: Object.values(KycStatus),
    default: KycStatus.NOT_STARTED,
  })
  status: KycStatus;

  @Prop()
  reviewAnswer: string;

  @Prop()
  reviewRejectType: string;

  @Prop()
  reviewComment: string;

  @Prop()
  reviewedAt: Date;

  // ===== AML =====
  @Prop({
    type: String,
    enum: ['NOT_STARTED', 'PENDING', 'COMPLETED'],
    default: 'NOT_STARTED',
  })
  amlStatus: string;

  @Prop({
    type: String,
    enum: ['GREEN', 'YELLOW', 'RED'],
  })
  amlResult: string;

  @Prop({ type: Array })
  amlHits: any[];

  @Prop({
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH'],
  })
  riskLevel: string;

  // ===== RAW WEBHOOK =====
  @Prop({ type: Object })
  rawWebhookPayload: Record<string, any>;
}
