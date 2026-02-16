import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Message extends Document {

  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true, index: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  applicationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  senderId: Types.ObjectId;

  @Prop({ enum: ['admin','user','system'], required: true })
  senderType: string;

  @Prop({ default: '' })
  message: string;

  @Prop({ default: 'text' })
  messageType: string; // text | image | file | system

  @Prop({ default: null })
  fileUrl: string;

  @Prop({ default: false, index: true })
  isRead: boolean;

  @Prop()
  readAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// ⭐ fast chat load
MessageSchema.index({ conversationId: 1, createdAt: 1 });

// ⭐ unread count fast
MessageSchema.index({ conversationId: 1, senderType: 1, isRead: 1 });
