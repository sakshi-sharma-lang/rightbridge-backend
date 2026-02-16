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
  // 🟢 USER SEND MESSAGE
  // =====================================================
  async sendMessageByUser(data: any) {
    const { userId, message, applicationId, fileUrl } = data;

    if (!userId) throw new BadRequestException('userId required');
    if (!applicationId) throw new BadRequestException('applicationId required');
    if (!message && !fileUrl)
      throw new BadRequestException('message required');

    const conversation = await this.getOrCreateConversation(userId, applicationId);

    const msg = await this.msgModel.create({
      conversationId: conversation._id,
      applicationId: new Types.ObjectId(applicationId),
      senderId: new Types.ObjectId(userId),
      senderType: 'user',
      message: message || '',
      fileUrl: fileUrl || null,
      messageType: fileUrl ? 'image' : 'text',
      isRead: false,
    });

    // sidebar update
    conversation.lastMessage = fileUrl ? '📎 File/Image' : message;
    conversation.lastMessageAt = new Date();
    conversation.unreadAdmin += 1;

    await conversation.save();
    return msg;
  }

  // =====================================================
  // 🔴 ADMIN SEND MESSAGE
  // =====================================================
  async sendMessageByAdmin(data: any) {
    const { userId, adminId, message, applicationId, fileUrl } = data;

    if (!adminId) throw new BadRequestException('adminId required');
    if (!userId) throw new BadRequestException('userId required');
    if (!applicationId) throw new BadRequestException('applicationId required');
    if (!message && !fileUrl)
      throw new BadRequestException('message required');

    if (!Types.ObjectId.isValid(adminId))
      throw new BadRequestException('Invalid adminId');

    const conversation = await this.getOrCreateConversation(userId, applicationId);

    const msg = await this.msgModel.create({
      conversationId: conversation._id,
      applicationId: new Types.ObjectId(applicationId),
      senderId: new Types.ObjectId(adminId),
      senderType: 'admin',
      message: message || '',
      fileUrl: fileUrl || null,
      messageType: fileUrl ? 'image' : 'text',
      isRead: false,
    });

    // sidebar update
    conversation.lastMessage = fileUrl ? '📎 File/Image' : message;
    conversation.lastMessageAt = new Date();
    conversation.unreadUser += 1;

    // assign admin
    conversation.assignedAdmin = new Types.ObjectId(adminId);

    await conversation.save();
    return msg;
  }

  // =====================================================
  // 🟢 USER OPEN CHAT
  // =====================================================
  async getUserChat(userId: string, applicationId: string) {
    const conversation = await this.getOrCreateConversation(userId, applicationId);
    const convoId = conversation._id;

    const messages = await this.msgModel
      .find({ conversationId: convoId })
      .sort({ createdAt: 1 });

    // mark admin msgs read
    await this.msgModel.updateMany(
      { conversationId: convoId, senderType: 'admin', isRead: false },
      { isRead: true, readAt: new Date() },
    );

    conversation.unreadUser = 0;
    await conversation.save();

    return { conversation, messages };
  }

  // =====================================================
  // 🔴 ADMIN OPEN CHAT
  // =====================================================
  async getAdminChat(userId: string, applicationId: string) {
    const conversation = await this.getOrCreateConversation(userId, applicationId);
    const convoId = conversation._id;

    const messages = await this.msgModel
      .find({ conversationId: convoId })
      .sort({ createdAt: 1 });

    // mark user msgs read
    await this.msgModel.updateMany(
      { conversationId: convoId, senderType: 'user', isRead: false },
      { isRead: true, readAt: new Date() },
    );

    conversation.unreadAdmin = 0;
    await conversation.save();

    return { conversation, messages };
  }

  // =====================================================
  // 🔴 ADMIN SIDEBAR
  // =====================================================
  async getAdminConversations() {
    return this.convoModel
      .find()
      .populate('userId', 'firstName lastName email')
      .populate('assignedAdmin', 'firstName lastName email')
      .sort({ updatedAt: -1 });
  }

  // =====================================================
  // 🟢 USER SIDEBAR
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
  // 🔔 ADMIN TOTAL UNREAD
  // =====================================================
  async getAdminTotalUnread() {
    const result = await this.convoModel.aggregate([
      { $group: { _id: null, total: { $sum: '$unreadAdmin' } } },
    ]);

    return result[0]?.total || 0;
  }
}
