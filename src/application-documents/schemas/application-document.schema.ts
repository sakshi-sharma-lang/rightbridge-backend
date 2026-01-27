import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { randomUUID } from 'crypto';

/* ===================== DOCUMENT ITEM ===================== */

@Schema()
export class DocumentItem {

  // ✅ FIX: use Node built-in UUID (no ESM issue)
  @Prop({ default: () => randomUUID() })
  uid?: string; // optional in TS

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

export const DocumentItemSchema = SchemaFactory.createForClass(DocumentItem);

/* ===================== APPLICATION DOCUMENT ===================== */

@Schema({ timestamps: true })
export class ApplicationDocument extends Document {

  @Prop({ required: true, index: true })
  applicationId: string;

  @Prop({ required: true, index: true })
  userId: string;

  // ✅ user uploaded documents
  @Prop({ type: [DocumentItemSchema], default: [] })
  documents: DocumentItem[];

  // ✅ admin uploaded documents (grouped)
  @Prop({
    type: {
      internal_document: { type: [DocumentItemSchema], default: [] },
      credit_report: { type: [DocumentItemSchema], default: [] },
    },
    default: {},
  })
  adminDocumentUpload: {
    internal_document: DocumentItem[];
    credit_report: DocumentItem[];
  };
}

export const ApplicationDocumentSchema =
  SchemaFactory.createForClass(ApplicationDocument);

/* ===================== UNIQUE INDEX ===================== */

ApplicationDocumentSchema.index(
  { applicationId: 1, userId: 1 },
  { unique: true },
);
