import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ValuationDocument = Valuation & Document;

@Schema({ timestamps: true })
export class Valuation {

  @Prop({ type: Types.ObjectId, ref: 'Application', required: true })
  applicationId: Types.ObjectId;

  // ADD THIS
  @Prop({ type: Types.ObjectId, ref: 'Surveyor', required: true })
  surveyorId: Types.ObjectId;

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

  // payment fields
  @Prop({ default: '' })
  paymentStatus: string;

  @Prop()
  stripePaymentIntentId: string;

  @Prop()
  paymentAmount: number;
}

export const ValuationSchema = SchemaFactory.createForClass(Valuation);