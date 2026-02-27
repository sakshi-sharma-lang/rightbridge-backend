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


  @Prop({ default: '' })
  role: string;

  @Prop({ type: Types.ObjectId, ref: 'Admin', required: true })
  adminId: Types.ObjectId;

  @Prop({ default: '' })
  adminName: string;



  // ================= LAST MESSAGE =================
  @Prop({ default: '' })
  lastMessage: string;

  @Prop()
  lastMessageAt: Date;

  @Prop({ default: '' })
  lastMessageBy: string; // user/admin

  @Prop({ default: 0 })
  unreadUser: number;

  @Prop({ default: 0 })
  unreadAdmin: number;

  @Prop({ default: 'open' })
  status: string;

  @Prop()
  userName: string;
   @Prop({ required: true })
  conversationKey: string;




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



ConversationSchema.index(
  { userId: 1, applicationId: 1, adminId: 1, role: 1 },
  { unique: true }
);