import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Application', required: true })
  applicationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, unique: true })
  stripePaymentIntentId: string;

  //  simple status field (store anything from Stripe)
  @Prop({ type: String, default: 'requires_payment_method' })
  status: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

// recommended index
PaymentSchema.index({ applicationId: 1, status: 1 });
