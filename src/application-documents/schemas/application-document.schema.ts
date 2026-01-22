import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export class DocumentItem {
  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  filePath: string;

  @Prop({ required: true })
  originalName: string;

  @Prop({ required: true })
  size: number;

@Prop({ required: true })
uploadedBy: string; 


  @Prop({ default: Date.now })
  createdAt: Date;
}

@Schema({ timestamps: true })
export class ApplicationDocument extends Document {
  @Prop({ required: true, index: true })
  applicationId: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ type: [DocumentItem], default: [] })
  documents: DocumentItem[];
}

export const ApplicationDocumentSchema =
  SchemaFactory.createForClass(ApplicationDocument);

ApplicationDocumentSchema.index(
  { applicationId: 1, userId: 1 },
  { unique: true },
);
