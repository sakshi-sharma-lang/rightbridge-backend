import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Message extends Document {

  @Prop({ type: Types.ObjectId, ref: 'conversations', required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  senderId: Types.ObjectId;

  @Prop({ enum: ['admin','user','system'], required: true })
  senderType: string;

  @Prop()
  message: string;

  @Prop({ default: 'text' })
  messageType: string;

  @Prop({ default: false })
  isRead: boolean;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
