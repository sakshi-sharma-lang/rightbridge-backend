import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SurveyorDocument = Surveyor & Document;

@Schema({ timestamps: true })
export class Surveyor {

  // one record per application
  @Prop({
    type: Types.ObjectId,
    ref: 'Application',
    required: true,
    unique: true,
  })
  applicationId: Types.ObjectId;

  // surveyor list
  @Prop([
    {
      name: { type: String, required: true },
      companyType: { type: String, required: true },
      price: { type: Number, required: true },
      turnaroundTime: { type: String, required: true },
      accreditation: { type: String, required: true },
      isActive: { type: Boolean, default: true },
    },
  ])
  surveyors: {
    _id?: Types.ObjectId;
    name: string;
    companyType: string;
    price: number;
    turnaroundTime: string;
    accreditation: string;
    isActive: boolean;
  }[];
}

export const SurveyorSchema = SchemaFactory.createForClass(Surveyor);
