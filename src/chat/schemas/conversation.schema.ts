import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Conversation extends Document {


  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;


  @Prop({ type: Types.ObjectId, ref: 'Admin', required: true })
  adminId: Types.ObjectId;

  @Prop({ default: '' })
  lastMessage: string;

  @Prop()
  lastMessageAt: Date;

  @Prop({ default: 0 })
  unreadUser: number;

  @Prop({ default: 0 })
  unreadAdmin: number;

  @Prop({ default: 'open' })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'applications', default: null })
applicationId: Types.ObjectId;

}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);


ConversationSchema.index({ userId: 1, adminId: 1 }, { unique: true });
