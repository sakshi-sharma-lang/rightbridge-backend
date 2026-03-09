import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ValuationDocument = Valuation & Document;

@Schema({ timestamps: true })
export class Valuation {

  @Prop({ type: Types.ObjectId, ref: 'Application', required: true })
  applicationId: Types.ObjectId;

  @Prop({ required: true })
  surveyorId: string;

  @Prop({ required: true })
  surveyorName: string;

  @Prop({ required: true })
  companyType: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  turnaroundTime: string;

  @Prop({ required: true })
  accreditation: string;

  // valuation type (example: residential / commercial)
  @Prop({ default: '' })
  type: string;

  // payment status
  @Prop({ default: 'pending' })
  paymentStatus: string;

  // stripe intent
  @Prop()
  stripePaymentIntentId: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
userId: Types.ObjectId;

  // amount paid
  @Prop()
  paymentAmount: number;

  // currency
  @Prop({ default: '' })
  currency: string;



  
}

export const ValuationSchema = SchemaFactory.createForClass(Valuation);

// useful index
ValuationSchema.index({ applicationId: 1 });