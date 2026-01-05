import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SurveyorDocument = Surveyor & Document;

@Schema({ timestamps: true })
export class Surveyor {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    required: true,
    enum: ['RICS Accredited', 'Independent', 'Other'],
  })
  companyType: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true })
  turnaroundTime: string;

  @Prop({ required: true })
  accreditation: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const SurveyorSchema = SchemaFactory.createForClass(Surveyor);
