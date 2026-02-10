import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class InternalNote extends Document {

  @Prop({ type: Types.ObjectId, ref: 'applications', required: true })
  applicationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'admins', required: true })
  adminId: Types.ObjectId;

  @Prop()
  adminName: string;

  @Prop({ required: true })
  message: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const InternalNoteSchema = SchemaFactory.createForClass(InternalNote);
