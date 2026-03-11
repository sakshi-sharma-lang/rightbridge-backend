import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type PaymentDocument = Payment & Document;

@Schema({ timestamps: true })
export class Payment {

  @Prop({ type: Types.ObjectId, ref: 'Application', required: true })
  applicationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  userId: Types.ObjectId;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  currency: string;

  @Prop({ required: true, unique: true })
  stripePaymentIntentId: string;

  @Prop({ type: String, default: '' })
  status: string;

  @Prop({ type: String, default: '' })
  paymentMethod: string; // pm_xxx

  @Prop({ type: [String], default: [] })
  paymentMethodTypes: string[]; // ["card","link"]

  @Prop({ type: Boolean, default: false })
  livemode: boolean;

  @Prop({ type: Number })
  stripeCreated: number;

  // your business fields
  @Prop({ type: String, default: '' })
  type: string;

  @Prop({ type: String, default: '' })
  surveyorId: string;

  @Prop({ type: String, default: '' })
  payId: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

// indexes
PaymentSchema.index({ applicationId: 1, status: 1 });
PaymentSchema.index({ stripePaymentIntentId: 1 });