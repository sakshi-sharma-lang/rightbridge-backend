import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({
  timestamps: { createdAt: true, updatedAt: false } //  fix here
})
export class InternalNote extends Document {

  @Prop({ type: Types.ObjectId, ref: 'applications', required: true })
  applicationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'admins', required: true })
  adminId: Types.ObjectId;

  @Prop()
  adminName: string;

  @Prop({
    type: [
      {
        message: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  messages: {
    message: string;
    createdAt: Date;
  }[];

  @Prop({ default: true })
  isActive: boolean;
}

export const InternalNoteSchema = SchemaFactory.createForClass(InternalNote);
