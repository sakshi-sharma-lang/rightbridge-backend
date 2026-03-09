import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type PaymentDocument = Payment & Document; // ✅ ADD THIS

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Application', required: true })
  applicationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  amount: number;

  @Prop({ type: String, default: '' })
  type: string;


  @Prop({ required: true, unique: true })
  stripePaymentIntentId: string;

  @Prop({ type: String, default: 'requires_payment_method' })
  status: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

// recommended index
PaymentSchema.index({ applicationId: 1, status: 1 });