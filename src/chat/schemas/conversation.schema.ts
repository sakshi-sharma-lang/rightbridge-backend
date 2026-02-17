import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true })
export class Conversation {

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Admin', default: null })
  assignedAdmin: Types.ObjectId;

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

  // ⭐ TEXT CHAT ARRAY ONLY
  @Prop({
    type: [
      {
        senderId: { type: Types.ObjectId },
        senderType: String, // user | admin
        message: String,
        messageType: { type: String, default: 'text' },
        time: Date,
        isRead: { type: Boolean, default: false },
      },
    ],
    default: [],
  })
  messages: any[];
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

// ⭐ ONLY ONE CONVERSATION PER USER + APPLICATION
ConversationSchema.index(
  { userId: 1, applicationId: 1 },
  { unique: true }
);
