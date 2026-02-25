import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true })
export class Conversation {

  // ================= USER =================
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  // ================= APPLICATION =================
  @Prop({ type: Types.ObjectId, required: true })
  applicationId: Types.ObjectId;

  // ================= ROLE =================
  // super_admin / underwriter / operations
  @Prop({
    type: String,
    enum: ['super_admin', 'underwriter', 'operations'],
    required: true,
  })
  role: string;

  // ================= TARGET ADMIN =================
  // jis admin ke saath user chat karega
  @Prop({ type: Types.ObjectId, ref: 'Admin', required: true })
  adminId: Types.ObjectId;

  @Prop({ default: '' })
  adminName: string;

  // realtime room key (can use conversationId also)
  @Prop({ required: true })
  conversationKey: string;

  // ================= LAST MESSAGE =================
  @Prop({ default: '' })
  lastMessage: string;

  @Prop()
  lastMessageAt: Date;

  @Prop({ default: '' })
  lastMessageBy: string; // user/admin

  // ================= UNREAD =================
  @Prop({ default: 0 })
  unreadUser: number;

  @Prop({ default: 0 })
  unreadAdmin: number;

  // ================= STATUS =================
  @Prop({ default: 'open' })
  status: string;

  @Prop()
  userName: string;

  // ================= MESSAGES =================
  @Prop({
    type: [
      {
        senderId: { type: Types.ObjectId, required: true },

        senderType: {
          type: String,
  
          required: true,
        },

        senderName: { type: String, required: true },
        senderRole: { type: String, required: true },

        message: { type: String, default: '' },
        messageType: { type: String, default: 'text' },

        time: { type: Date, default: Date.now },
        isRead: { type: Boolean, default: false },
      },
    ],
    default: [],
  })
  messages: any[];
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

//
// 🔥 MOST IMPORTANT PART
// Multi admin support ke liye correct unique index
//

ConversationSchema.index(
  { userId: 1, applicationId: 1, adminId: 1, role: 1 },
  { unique: true }
);