import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true })
export class Conversation {

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  // single admin system
  @Prop({ type: Types.ObjectId, ref: 'Admin', default: null })
  assignedAdmin: Types.ObjectId;

  // application based chat (REQUIRED)
  @Prop({ type: Types.ObjectId, required: true })
  applicationId: Types.ObjectId;

  @Prop({ default: '' })
  lastMessage: string;

  @Prop({ default: 0 })
  unreadUser: number;

  @Prop({ default: 0 })
  unreadAdmin: number;

  @Prop({ default: 'open' })
  status: string;

  @Prop()
  lastMessageAt: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

// ⭐ IMPORTANT: one conversation per user per application
ConversationSchema.index(
  { userId: 1, applicationId: 1 },
  { unique: true }
);
