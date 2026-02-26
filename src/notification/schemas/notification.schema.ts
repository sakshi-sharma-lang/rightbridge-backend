import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  // Optional
  @Prop({ type: Types.ObjectId, ref: 'Application', required: false })
  applicationId?: Types.ObjectId | null;

  @Prop({ required: true })
  stage: string;

  @Prop({ required: true })
  message: string;

  @Prop({ default: false })
  isRead: boolean;

  @Prop({ default: 'stage_update' })
  type: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const NotificationSchema =
  SchemaFactory.createForClass(Notification);