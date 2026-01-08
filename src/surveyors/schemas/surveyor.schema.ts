import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SurveyorDocument = Surveyor & Document;

@Schema({ timestamps: true })
export class Surveyor {
  @Prop({ required: true, trim: true })
  name: string;

 @Prop({
    required: true,
    enum: ['Rics_Accredited', 'Independent', 'Other'],
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

   @Prop({
    type: [{ type: Types.ObjectId, ref: 'Application' }],
    required: true,
  })

    applicationIds: Types.ObjectId[];
}

export const SurveyorSchema = SchemaFactory.createForClass(Surveyor);
