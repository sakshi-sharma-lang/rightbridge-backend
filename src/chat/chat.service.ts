import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Conversation } from './schemas/conversation.schema';
import { Message } from './schemas/message.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversation.name) private convoModel: Model<Conversation>,
    @InjectModel(Message.name) private msgModel: Model<Message>,
  ) {}

  // ================= UNIQUE CONVERSATION =================
  async getOrCreateConversation(userId: string, adminId: string) {
    let convo = await this.convoModel.findOne({ userId, adminId });

    if (!convo) {
      convo = await this.convoModel.create({ userId, adminId });
    }

    return convo;
  }

  // ================= SAVE MESSAGE (MAIN CORE) =================
  async saveMessage(data: any) {
    const { userId, adminId, message, senderRole } = data;

    if (!userId || !adminId || !message) {
      throw new BadRequestException('userId, adminId and message required');
    }

    // 🔥 role detect (secure)
    let senderType: 'admin' | 'user';

    if (senderRole === 'admin') {
      senderType = 'admin';
    } else {
      senderType = 'user';
    }

    const conversation = await this.getOrCreateConversation(userId, adminId);

    const msg = await this.msgModel.create({
      conversationId: conversation._id,
      senderId: senderType === 'admin' ? adminId : userId,
      senderType,
      message,
    });

    // update conversation
    conversation.lastMessage = message;
    conversation.lastMessageAt = new Date();

    if (senderType === 'admin') {
      conversation.unreadUser += 1;
    } else {
      conversation.unreadAdmin += 1;
    }

    await conversation.save();

    return msg;
  }

  // ================= GET MESSAGES =================
  async getMessages(conversationId: string) {
    return this.msgModel
      .find({ conversationId })
      .sort({ createdAt: 1 });
  }

  // ================= ADMIN SIDEBAR =================
  async getAdminConversations(adminId: string) {
    return this.convoModel
      .find({ adminId })
      .populate('userId', 'firstName lastName email')
      .sort({ updatedAt: -1 });
  }

  // ================= USER SIDEBAR =================
  async getUserConversations(userId: string) {
    return this.convoModel
      .find({ userId })
      .populate('adminId', 'firstName lastName')
      .sort({ updatedAt: -1 });
  }

  // ================= UNIQUE CHAT ROUTE =================
  async getUniqueConversation(userId: string, adminId: string) {
    let convo = await this.convoModel.findOne({ userId, adminId });

    if (!convo) {
      convo = await this.convoModel.create({ userId, adminId });
    }

    return convo;
  }
}
