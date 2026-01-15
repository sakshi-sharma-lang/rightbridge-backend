import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export enum PaymentStatus {
  PENDING = 'PENDING',   // intent created, waiting for Stripe
  PAID = 'PAID',         // payment_intent.succeeded
  FAILED = 'FAILED',     // payment_intent.payment_failed
  REFUNDED = 'REFUNDED', // future-safe
}

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Application', required: true })
  applicationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  amount: number; // ALWAYS from Stripe (intent.amount / 100)

  @Prop({ required: true, unique: true })
  stripePaymentIntentId: string;

  @Prop({
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

// 🔒 Recommended index
PaymentSchema.index({ applicationId: 1, status: 1 });
