import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true })
export class Conversation {

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Admin', default: null })
  assignedAdmin: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null })
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
