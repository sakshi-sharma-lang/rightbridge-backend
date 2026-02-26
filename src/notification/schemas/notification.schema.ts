import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {

@Prop({ required: false })
userId: Types.ObjectId;

  // Optional
  @Prop({ type: Types.ObjectId, ref: 'Application', required: false })
  applicationId?: Types.ObjectId | null;

  @Prop({ required: true })
  stage: string;

  @Prop({ type: Types.ObjectId, ref: 'Admin', required: false })
  adminId?: Types.ObjectId;

  @Prop({ required: true })
  message: string;

  @Prop({ default: false })
  isRead: boolean;

  @Prop({ default: '' })
  type: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const NotificationSchema =
  SchemaFactory.createForClass(Notification);