import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Message extends Document {

  // conversation id
  @Prop({ type: Types.ObjectId, ref: 'conversations', required: true })
  conversationId: Types.ObjectId;

  // application id (correct ref)
  @Prop({ type: Types.ObjectId, ref: 'applications', required: true })
  applicationId: Types.ObjectId;

  // sender
  @Prop({ type: Types.ObjectId, required: true })
  senderId: Types.ObjectId;

  @Prop({ enum: ['admin','user','system'], required: true })
  senderType: string;

  // message content
  @Prop()
  message: string;

  @Prop({ default: 'text' }) // text | file | image
  messageType: string;

  // seen/unseen
  @Prop({ default: false })
  isRead: boolean;

  // optional: read time
  @Prop()
  readAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
