import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ApplicationDocument extends Document {
  @Prop({ required: true, index: true })
  applicationId: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  type: string; // identity, address, etc.

  @Prop({ required: true })
  filePath: string;

  @Prop({ required: true })
  originalName: string;

  @Prop({ required: true })
  size: number;
}

export const ApplicationDocumentSchema =
  SchemaFactory.createForClass(ApplicationDocument);

// Prevent duplicate document per application + type
ApplicationDocumentSchema.index(
  { applicationId: 1, type: 1 },
  { unique: true },
);
