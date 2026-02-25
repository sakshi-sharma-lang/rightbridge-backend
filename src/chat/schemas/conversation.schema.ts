import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true })
export class Conversation {

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  applicationId: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['super_admin','SUPER_ADMIN','underwriter','operations','operation'],
  })
  role: string;

  @Prop({ type: Types.ObjectId, ref: 'Admin', required: true })
  adminId: Types.ObjectId;

  @Prop({ default: '' })
  adminName: string;

  // 🔥 conversation key auto generate
  @Prop({ required: false })
  conversationKey: string;

  @Prop({ default: '' })
  lastMessage: string;

  @Prop()
  lastMessageAt: Date;

  @Prop({ default: '' })
  lastMessageBy: string;

  @Prop({ default: 0 })
  unreadUser: number;

  @Prop({ default: 0 })
  unreadAdmin: number;

  @Prop({ default: 'open' })
  status: string;

  @Prop()
  userName: string;

  @Prop({
    type: [
      {
        senderId: { type: Types.ObjectId, required: true },
        senderType: { type: String, enum: ['user','admin'], required: true },
        senderName: { type: String },
        senderRole: { type: String },
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
// 🔥 AUTO CREATE conversationKey
//
ConversationSchema.pre('save', function(next) {
  if (!this.conversationKey) {
    this.conversationKey =
      this.userId.toString() + "_" + this.applicationId.toString();
  }
  next();
});

//
// 🔥 ONE CONVERSATION PER APPLICATION
//
ConversationSchema.index(
  { userId: 1, applicationId: 1 },
  { unique: true }
);