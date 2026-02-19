import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, Document } from 'mongoose';
import { Conversation } from './schemas/conversation.schema';

type ConversationDocument = Conversation & Document;

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversation.name)
    private convoModel: Model<ConversationDocument>,
  ) {}

  // =====================================================
  // CREATE OR GET CONVERSATION (ONLY ONE ROW)
  // =====================================================
  async getOrCreateConversation(
    userId: string,
    applicationId: string,
  ): Promise<ConversationDocument> {

    if (!Types.ObjectId.isValid(userId))
      throw new BadRequestException('Invalid userId');

    if (!Types.ObjectId.isValid(applicationId))
      throw new BadRequestException('Invalid applicationId');

    const userObj = new Types.ObjectId(userId);
    const appObj = new Types.ObjectId(applicationId);

    let convo = await this.convoModel.findOne({
      userId: userObj,
      applicationId: appObj,
    });

    if (convo) return convo;

    try {
      convo = await this.convoModel.create({
        userId: userObj,
        applicationId: appObj,
        unreadUser: 0,
        unreadAdmin: 0,
        status: 'open',
        messages: [],
      });

      return convo;

    } catch (err: any) {

      if (err.code === 11000) {
        const existing = await this.convoModel.findOne({
          userId: userObj,
          applicationId: appObj,
        });

        if (!existing) throw new BadRequestException('Conversation failed');
        return existing;
      }

      throw err;
    }
  }

  // =====================================================
  // USER SEND MESSAGE
  // =====================================================
  async sendMessageByUser(data: any) {

    const { userId, message, applicationId } = data;

    if (!userId) throw new BadRequestException('userId required');
    if (!applicationId) throw new BadRequestException('applicationId required');
    if (!message) throw new BadRequestException('message required');

    const conversation = await this.getOrCreateConversation(userId, applicationId);

    conversation.messages.push({
      senderId: new Types.ObjectId(userId),
      senderType: 'user',
      message: message,
      messageType: 'text',
      time: new Date(),
      isRead: false,
    });

    conversation.lastMessage = message;
    conversation.lastMessageAt = new Date();
    conversation.unreadAdmin += 1;

    await conversation.save();

    const lastMsg = conversation.messages[conversation.messages.length - 1];

    return {
      success: true,
      senderType: 'user',
      message: lastMsg,
      conversationId: conversation._id,
      unreadAdmin: conversation.unreadAdmin,
      applicationId,
      userId
    };
  }

  // =====================================================
  // ADMIN SEND MESSAGE
  // =====================================================
  async sendMessageByAdmin(data: any) {

    const { userId, adminId, message, applicationId } = data;

    if (!adminId) throw new BadRequestException('adminId required');
    if (!userId) throw new BadRequestException('userId required');
    if (!applicationId) throw new BadRequestException('applicationId required');
    if (!message) throw new BadRequestException('message required');

    const conversation = await this.getOrCreateConversation(userId, applicationId);

    conversation.messages.push({
      senderId: new Types.ObjectId(adminId),
      senderType: 'admin',
      message: message,
      messageType: 'text',
      time: new Date(),
      isRead: false,
    });

    conversation.lastMessage = message;
    conversation.lastMessageAt = new Date();
    conversation.unreadUser += 1;
    conversation.assignedAdmin = new Types.ObjectId(adminId);

    await conversation.save();

    const lastMsg = conversation.messages[conversation.messages.length - 1];

    return {
      success: true,
      senderType: 'admin',
      message: lastMsg,
      conversationId: conversation._id,
      unreadUser: conversation.unreadUser,
      applicationId,
      userId
    };
  }

  // =====================================================
  // USER OPEN CHAT
  // =====================================================
  async getUserChat(userId: string, applicationId: string) {

    const conversation = await this.getOrCreateConversation(userId, applicationId);

    let updated = false;

    conversation.messages.forEach((msg: any) => {
      if (msg.senderType === 'admin' && msg.isRead === false) {
        msg.isRead = true;
        updated = true;
      }
    });

    if (conversation.unreadUser !== 0) {
      conversation.unreadUser = 0;
      updated = true;
    }

    if (updated) {
      await conversation.save();
    }

    return {
      conversationId: conversation._id,
      unreadUser: conversation.unreadUser,
      messages: conversation.messages,
    };
  }

  // =====================================================
  // USER OPEN CHAT BY APPLICATION ID
  // =====================================================
  async getUserChatByApplication(applicationId: string) {

    if (!Types.ObjectId.isValid(applicationId))
      throw new BadRequestException('Invalid applicationId');

    const conversation = await this.convoModel.findOne({
      applicationId: new Types.ObjectId(applicationId),
    });

    if (!conversation) {
      throw new BadRequestException('Conversation not found');
    }

    let updated = false;

    conversation.messages.forEach((msg: any) => {
      if (msg.senderType === 'admin' && msg.isRead === false) {
        msg.isRead = true;
        updated = true;
      }
    });

    if (conversation.unreadUser !== 0) {
      conversation.unreadUser = 0;
      updated = true;
    }

    if (updated) await conversation.save();

    return {
      conversationId: conversation._id,
      unreadUser: conversation.unreadUser,
      messages: conversation.messages,
    };
  }

  // =====================================================
  // ADMIN OPEN CHAT
  // =====================================================
  async getAdminChat(applicationId: string) {

    if (!Types.ObjectId.isValid(applicationId))
      throw new BadRequestException('Invalid applicationId');

    const conversation = await this.convoModel.findOne({
      applicationId: new Types.ObjectId(applicationId),
    });

    if (!conversation) {
      throw new BadRequestException('Conversation not found for this application');
    }

    let updated = false;

    conversation.messages.forEach((msg: any) => {
      if (msg.senderType === 'user' && msg.isRead === false) {
        msg.isRead = true;
        updated = true;
      }
    });

    if (conversation.unreadAdmin !== 0) {
      conversation.unreadAdmin = 0;
      updated = true;
    }

    if (updated) {
      await conversation.save();
    }

    return {
      conversationId: conversation._id,
      unreadAdmin: conversation.unreadAdmin,
      messages: conversation.messages,
    };
  }

  // =====================================================
  // ADMIN SIDEBAR
  // =====================================================
  async getAdminConversations() {
    return this.convoModel
      .find()
      .populate('userId', 'firstName lastName email')
      .populate('assignedAdmin', 'firstName lastName email')
      .sort({ updatedAt: -1 });
  }

  // =====================================================
  // USER SIDEBAR
  // =====================================================
  async getUserConversations(userId: string) {

    if (!Types.ObjectId.isValid(userId))
      throw new BadRequestException('Invalid userId');

    return this.convoModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('assignedAdmin', 'firstName lastName email')
      .sort({ updatedAt: -1 });
  }

  // =====================================================
  // ADMIN TOTAL UNREAD
  // =====================================================
  async getAdminTotalUnread() {

    const result = await this.convoModel.aggregate([
      { $group: { _id: null, total: { $sum: '$unreadAdmin' } } },
    ]);

    return result[0]?.total || 0;
  }

  // =====================================================
  // USER TOTAL UNREAD
  // =====================================================
  async getUserTotalUnread(userId: string) {

    if (!Types.ObjectId.isValid(userId))
      throw new BadRequestException('Invalid userId');

    const result = await this.convoModel.aggregate([
      { $match: { userId: new Types.ObjectId(userId) } },
      { $group: { _id: null, total: { $sum: '$unreadUser' } } },
    ]);

    return result[0]?.total || 0;
  }
}
