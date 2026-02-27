import { Injectable, BadRequestException ,InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, Document } from 'mongoose';
import { Conversation } from './schemas/conversation.schema';
import { Application } from '../applications/schemas/application.schema';
import { Admin } from '../admin/schemas/admin.schema';
import { User } from '../users/schemas/user.schema';

import { NotificationService } from '../notification/notification.service';
import { Inject, forwardRef } from '@nestjs/common';

type ConversationDocument = Conversation & Document;

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversation.name)
    private convoModel: Model<ConversationDocument>,

    @InjectModel(Application.name)
    private applicationModel: Model<Application>,

    @InjectModel(Admin.name)
    private adminModel: Model<Admin>,

    @InjectModel(User.name)
    private userModel: Model<User>,

      @Inject(forwardRef(() => NotificationService))
  private notificationService: NotificationService,
  ) {}

  // =====================================================
  // INTERNAL: GET OR CREATE CONVERSATION (SAFE)
  // =====================================================
  private async getOrCreateConversation(
    userId: string,
    applicationId: string,
    adminId: string,
    role: string,
    userName: string,
    adminName: string,
  ) {
    let conversation = await this.convoModel.findOne({
      userId: new Types.ObjectId(userId),
      applicationId: new Types.ObjectId(applicationId),
      adminId: new Types.ObjectId(adminId),
      role,
    });

    if (conversation) return conversation;

   // const conversationKey = `${applicationId}_${adminId}_${userId}`;

    conversation = await this.convoModel.create({
      userId: new Types.ObjectId(userId),
      applicationId: new Types.ObjectId(applicationId),
      adminId: new Types.ObjectId(adminId),
      role,
     // conversationKey,
      userName,
      adminName,
      unreadUser: 0,
      unreadAdmin: 0,
      status: 'open',
      messages: [],
    });

    return conversation;
  }

  // =====================================================
  // USER SEND MESSAGE
  // =====================================================
async sendMessageByUser(data: any) {

  const { userId, adminId, message, applicationId, role } = data;

  const allowedRoles = ['super_admin', 'underwriter', 'operations'];

  if (!userId || !applicationId || !adminId || !message || !role)
    throw new BadRequestException('Missing required fields');

  if (!allowedRoles.includes(role))
    throw new BadRequestException('Invalid role');

  if (!Types.ObjectId.isValid(userId))
    throw new BadRequestException('Invalid userId');

  if (!Types.ObjectId.isValid(applicationId))
    throw new BadRequestException('Invalid applicationId');

  if (!Types.ObjectId.isValid(adminId))
    throw new BadRequestException('Invalid adminId');

  const user: any = await this.userModel
    .findById(userId)
    .select('_id firstName lastName')
    .lean();

  if (!user) throw new BadRequestException('User not found');

  const admin: any = await this.adminModel
    .findById(adminId)
    .select('_id role fullName email')
    .lean();

  if (!admin) throw new BadRequestException('Admin not found');

  const application = await this.applicationModel.findOne({
    _id: new Types.ObjectId(applicationId),
    userId: new Types.ObjectId(userId),
  });

  if (!application)
    throw new BadRequestException('Application invalid');

  const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  const adminName = admin.fullName || admin.email;

  const conversation = await this.getOrCreateConversation(
    userId,
    applicationId,
    adminId,
    role, // ✅ frontend role
    userName,
    adminName,
  );

  const newMessage = {
    senderId: new Types.ObjectId(userId),
    senderType: 'user',
    senderName: userName,
    senderRole: 'user',
    message,
    messageType: 'text',
    time: new Date(),
  };

  conversation.messages.push(newMessage);
  conversation.lastMessage = message;
  conversation.lastMessageAt = new Date();
  conversation.lastMessageBy = 'user';
  conversation.unreadAdmin += 1;

  await conversation.save();

  await this.notificationService.sendToAdmin({
    adminId,
    message: `${userName} sent you a message`,
    stage: 'chat_message',
    type: 'chat',
    applicationId,
  });

  return {
    success: true,
    conversation,
    messageData: newMessage,
  };
}

  // =====================================================
  // ADMIN SEND MESSAGE
  // =====================================================
  async sendMessageByAdmin(data: any) {
  try {
    const { userId, adminId, message, applicationId, role } = data;

    // validate input
    if (!userId || !adminId || !applicationId || !message || !role) {
      throw new BadRequestException('Missing required fields');
    }

    // find admin
    const admin: any = await this.adminModel
      .findById(adminId)
      .select('_id role fullName email')
      .lean();

    if (!admin) {
      throw new BadRequestException('Admin not found');
    }

    // find user
    const user: any = await this.userModel
      .findById(userId)
      .select('_id firstName lastName')
      .lean();

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // check application
    const application = await this.applicationModel.findOne({
      _id: new Types.ObjectId(applicationId),
      userId: new Types.ObjectId(userId),
    });

    if (!application) {
      throw new BadRequestException('Application invalid');
    }

    const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    const adminName = admin.fullName || admin.email;

    // get/create conversation (role from frontend)
    const conversation = await this.getOrCreateConversation(
      userId,
      applicationId,
      adminId,
      role, // <-- from frontend body
      userName,
      adminName,
    );

    // create message object
    const newMessage = {
      senderId: new Types.ObjectId(adminId),
      senderType: 'admin',
      senderName: adminName,
      senderRole: role, // <-- saved from frontend
      message,
      messageType: 'text',
      time: new Date(),
    };

    // update conversation
    conversation.messages.push(newMessage);
    conversation.lastMessage = message;
    conversation.lastMessageAt = new Date();
    conversation.lastMessageBy = 'admin';
    conversation.unreadUser += 1;
    conversation.unreadAdmin = 0;

    await conversation.save();

    // 🔔 Notify User
    await this.notificationService.sendToUser({
      userId,
      message: `${adminName} replied to your message`,
      stage: 'chat_message',
      type: 'chat',
      applicationId,
    });

    return {
      success: true,
      message: 'Message sent successfully',
      conversation,
      messageData: newMessage,
    };
  } catch (error) {
    console.error('sendMessageByAdmin error:', error);

    if (error instanceof BadRequestException) {
      throw error;
    }

    if (error.name === 'CastError') {
      throw new BadRequestException('Invalid ID format');
    }

    throw new InternalServerErrorException('Failed to send message');
  }
}

  // =====================================================
  // USER OPEN CHAT
  // =====================================================
  async getUserChat(userId: string, applicationId: string, role: string) {

    const conversation = await this.convoModel.findOne({
      userId: new Types.ObjectId(userId),
      applicationId: new Types.ObjectId(applicationId),
      role,
    });

    if (!conversation)
      return { success: true, data: [] };

    // conversation.messages.forEach((msg: any) => {
    //   if (msg.senderType === 'admin') msg.isRead = true;
    // });

    conversation.unreadUser = 0;
    await conversation.save();

    return {
      success: true,
      adminId: conversation.adminId,
      role: conversation.role,
      data: conversation,
    };
  }
  // =====================================================
  // ADMIN OPEN CHAT
  // =====================================================
  async getAdminChat(applicationId: string, role: string, adminId: string) {

    const conversation = await this.convoModel.findOne({
      applicationId: new Types.ObjectId(applicationId),
      adminId: new Types.ObjectId(adminId),
      role,
    });

    if (!conversation)
      return { success: true, data: [] };

    // conversation.messages.forEach((msg: any) => {
    //   if (msg.senderType === 'user') msg.isRead = true;
    // });

    conversation.unreadAdmin = 0;
    await conversation.save();

    return {
      success: true,
      data: conversation,
    };
  }
  async getUserConversations(userId: string, applicationId: string) {

  if (!Types.ObjectId.isValid(userId))
    throw new BadRequestException('Invalid userId');

  if (!Types.ObjectId.isValid(applicationId))
    throw new BadRequestException('Invalid applicationId');

  const conversations = await this.convoModel.find({
    userId: new Types.ObjectId(userId),
    applicationId: new Types.ObjectId(applicationId),
  }).lean();

  let totalUnreadAll = 0;

  // 🔥 role count object
  const roleCounts: any = {
    super_admin: 0,
    underwriter: 0,
    operations: 0,
  };

  const roles = conversations.map((conv) => {

    totalUnreadAll += conv.unreadUser || 0;

    // 🔥 count per role
    if (conv.role && roleCounts[conv.role] !== undefined) {
      roleCounts[conv.role] += 1;
    }

    return {
      role: conv.role,
      adminId: conv.adminId,
      adminName: conv.adminName || '',
      lastMessage: conv.lastMessage,
      lastMessageBy: conv.lastMessageBy,
      unread: conv.unreadUser,
      totalMessages: conv.messages?.length || 0,
      lastMessageAt: conv.lastMessageAt,
    };
  });

  return {
    success: true,
    applicationId,
    userId,
    totalUnreadAll,
    roleCounts, // 🔥 THIS YOU WANTED
    roles,
  };
   }

async getApplicationsByUserId(userId: string) {

      const applications = await this.applicationModel
        .find({ userId: new Types.ObjectId(userId) })
        .select('_id appId status applicationStatus createdAt')
        .sort({ createdAt: -1 })
        .lean();

      return {
        success: true,
        total: applications.length,
        data: applications,
      };
    }

   async getAdminConversations(adminId: string) {
      if (!Types.ObjectId.isValid(adminId))
        throw new BadRequestException('Invalid adminId');

      return this.convoModel
        .find({ adminId: new Types.ObjectId(adminId) })
        .populate('userId', 'firstName lastName email')
        .sort({ updatedAt: -1 });
    }
    // =====================================================
  async getAdminTotalUnread(adminId: string) {

    const conversations = await this.convoModel.find({
      adminId: new Types.ObjectId(adminId),
    });

    let totalUnread = 0;

    conversations.forEach((conv) => {
      totalUnread += conv.unreadAdmin || 0;
    });

    return {
      success: true,
      totalUnread,
    };
    }
  async getUserTotalUnread(userId: string) {

  const conversations = await this.convoModel.find({
    userId: new Types.ObjectId(userId),
  });

  let totalUnread = 0;

  conversations.forEach((conv) => {
    totalUnread += conv.unreadUser || 0;
  });

  return {
    success: true,
    totalUnread,
  };
  }
}