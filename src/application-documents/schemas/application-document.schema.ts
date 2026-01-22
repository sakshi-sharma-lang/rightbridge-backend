import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

class DocumentItem {
  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  filePath: string;

  @Prop({ required: true })
  originalName: string;

  @Prop({ required: true })
  size: number;
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

// ✅ One record per application + user
ApplicationDocumentSchema.index(
  { applicationId: 1, userId: 1 },
  { unique: true },
);