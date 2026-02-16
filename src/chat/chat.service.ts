import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation } from './schemas/conversation.schema';
import { Message } from './schemas/message.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversation.name) private convoModel: Model<Conversation>,
    @InjectModel(Message.name) private msgModel: Model<Message>,
  ) {}

  // =====================================================
  // CREATE OR GET CONVERSATION
  // =====================================================
  async getOrCreateConversation(userId: string, applicationId: string) {

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

    if (!convo) {
      try {
        convo = await this.convoModel.create({
          userId: userObj,
          applicationId: appObj,
          unreadUser: 0,
          unreadAdmin: 0,
          status: 'open',
        });
      } catch (err: any) {
        if (err.code === 11000) {
          convo = await this.convoModel.findOne({
            userId: userObj,
            applicationId: appObj,
          });
        } else {
          throw err;
        }
      }
    }

    if (!convo) {
      throw new BadRequestException('Conversation creation failed');
    }

    return convo;
  }

  // =====================================================
  // SEND MESSAGE
  // =====================================================
  async saveMessage(data: any) {

    const { userId, adminId, message, senderRole, applicationId, fileUrl } = data;

    if (!userId) throw new BadRequestException('userId required');
    if (!applicationId) throw new BadRequestException('applicationId required');
    if (!message && !fileUrl) throw new BadRequestException('message required');

    let senderType: 'admin' | 'user';
    let senderId: string;

    if (senderRole === 'admin') {
      if (!adminId) throw new BadRequestException('adminId required');
      if (!Types.ObjectId.isValid(adminId))
        throw new BadRequestException('Invalid adminId');

      senderType = 'admin';
      senderId = adminId;
    } else {
      senderType = 'user';
      senderId = userId;
    }

    const conversation = await this.getOrCreateConversation(userId, applicationId);

    // create message
    const msg = await this.msgModel.create({
      conversationId: conversation._id,
      applicationId: new Types.ObjectId(applicationId),
      senderId: new Types.ObjectId(senderId),
      senderType,
      message: message || '',
      fileUrl: fileUrl || null,
      messageType: fileUrl ? 'image' : 'text',
      isRead: false,
    });

    // =====================================================
    // UPDATE CONVERSATION SIDEBAR
    // =====================================================
    conversation.lastMessage = fileUrl ? '📎 File/Image' : message;
    conversation.lastMessageAt = new Date();

    if (senderType === 'admin') {
      conversation.unreadUser += 1;
    } else {
      conversation.unreadAdmin += 1;
    }

    // =====================================================
    // ⭐ ALWAYS SAVE ADMIN ID WHEN ADMIN SEND MESSAGE
    // =====================================================
    if (senderType === 'admin') {
      conversation.assignedAdmin = new Types.ObjectId(adminId);
    }

    await conversation.save();

    return msg;
  }

  // =====================================================
  // ⭐ SINGLE CHAT API (MAIN CHAT OPEN)
  // =====================================================
  async getChatByUserApplication(
    userId: string,
    applicationId: string,
    viewer: 'admin' | 'user',
  ) {

    if (!Types.ObjectId.isValid(userId))
      throw new BadRequestException('Invalid userId');

    if (!Types.ObjectId.isValid(applicationId))
      throw new BadRequestException('Invalid applicationId');

    const conversation = await this.getOrCreateConversation(userId, applicationId);
    const convoId = conversation._id;

    const messages = await this.msgModel
      .find({ conversationId: convoId })
      .sort({ createdAt: 1 });

    // =============================
    // MARK SEEN
    // =============================
    if (viewer === 'admin') {

      await this.msgModel.updateMany(
        { conversationId: convoId, senderType: 'user', isRead: false },
        { isRead: true, readAt: new Date() },
      );

      conversation.unreadAdmin = 0;
      await conversation.save();
    }

    if (viewer === 'user') {

      await this.msgModel.updateMany(
        { conversationId: convoId, senderType: 'admin', isRead: false },
        { isRead: true, readAt: new Date() },
      );

      conversation.unreadUser = 0;
      await conversation.save();
    }

    return {
      conversation,
      messages,
    };
  }

  // =====================================================
  // ADMIN SIDEBAR ALL CHATS
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
  // ADMIN TOTAL UNREAD (TOP BELL)
  // =====================================================
  async getAdminTotalUnread() {
    const result = await this.convoModel.aggregate([
      { $group: { _id: null, total: { $sum: '$unreadAdmin' } } },
    ]);

    return result[0]?.total || 0;
  }
}
