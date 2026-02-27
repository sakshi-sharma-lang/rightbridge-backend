import { Injectable, BadRequestException ,InternalServerErrorException ,NotFoundException } from '@nestjs/common';
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
  try {
    const { userId, adminId, message, applicationId, role } = data;

    // const allowedRoles = ['super_admin', 'underwriter', 'operations'];

    // ===============================
    // Required Field Validation
    // ===============================
    if (!userId)
      throw new BadRequestException('userId is required');

    if (!applicationId)
      throw new BadRequestException('applicationId is required');

    if (!adminId)
      throw new BadRequestException('adminId is required');

    if (!message || typeof message !== 'string' || !message.trim())
      throw new BadRequestException('message must be a non-empty string');

    if (!role)
      throw new BadRequestException('role is required');

    // ===============================
    // Role Validation
    // ===============================
    // if (!allowedRoles.includes(role))
    //   throw new BadRequestException(
    //     `Invalid role. Allowed roles: ${allowedRoles.join(', ')}`
    //   );

    // ===============================
    // ObjectId Validation
    // ===============================
    if (!Types.ObjectId.isValid(userId))
      throw new BadRequestException('Invalid userId format');

    if (!Types.ObjectId.isValid(applicationId))
      throw new BadRequestException('Invalid applicationId format');

    if (!Types.ObjectId.isValid(adminId))
      throw new BadRequestException('Invalid adminId format');

    // ===============================
    // Fetch User
    // ===============================
    const user: any = await this.userModel
      .findById(userId)
      .select('_id firstName lastName')
      .lean();

    if (!user)
      throw new NotFoundException('User not found');

    // ===============================
    // Fetch Admin
    // ===============================
    const admin: any = await this.adminModel
      .findById(adminId)
      .select('_id role fullName email')
      .lean();

    if (!admin)
      throw new NotFoundException('Admin not found');

    // ===============================
    // Validate Application Ownership
    // ===============================
    const application = await this.applicationModel.findOne({
      _id: new Types.ObjectId(applicationId),
      userId: new Types.ObjectId(userId),
    });

    if (!application)
      throw new BadRequestException(
        'Application does not belong to this user'
      );

    // ===============================
    // Prepare Names
    // ===============================
    const userName =
      `${user.firstName || ''} ${user.lastName || ''}`.trim();

    const adminName = admin.fullName || admin.email;

    // ===============================
    // Get or Create Conversation
    // ===============================
    const conversation = await this.getOrCreateConversation(
      userId,
      applicationId,
      adminId,
      role,
      userName,
      adminName,
    );

    // ===============================
    // Prepare Message Object
    // ===============================
    const newMessage = {
      senderId: new Types.ObjectId(userId),
      senderType: 'user',
      senderName: userName,
      senderRole: 'user',
      message: message.trim(),
      messageType: 'text',
      time: new Date(),
    };

    // ===============================
    // Update Conversation
    // ===============================
    conversation.messages.push(newMessage);
    conversation.lastMessage = message.trim();
    conversation.lastMessageAt = new Date();
    conversation.lastMessageBy = 'user';
    conversation.unreadAdmin = (conversation.unreadAdmin || 0) + 1;

    await conversation.save();

    // ===============================
    // Send Notification To Admin
    // ===============================
    await this.notificationService.sendToAdmin({
      adminId,
      message: `${userName} sent you a message`,
      stage: 'chat_message',
      type: 'chat',
      applicationId,
    });

    // ===============================
    // Return Response
    // ===============================
    return {
      success: true,
      message: 'Message sent successfully',
      conversationId: conversation._id,
      messageData: newMessage,
    };

  } catch (error) {
    if (error instanceof BadRequestException || error instanceof NotFoundException) {
      throw error;
    }

    console.error('sendMessageByUser Error:', error);
    throw new InternalServerErrorException(
      'Something went wrong while sending message'
    );
  }
}

  // =====================================================
  // ADMIN SEND MESSAGE
  // =====================================================
 async sendMessageByAdmin(data: any) {
  try {
    const { userId, adminId, message, applicationId, role } = data;

    ///const allowedRoles = ['super_admin', 'underwriter', 'operations'];

    // ===============================
    // Required Field Validation
    // ===============================
    if (!userId)
      throw new BadRequestException('userId is required');

    if (!adminId)
      throw new BadRequestException('adminId is required');

    if (!applicationId)
      throw new BadRequestException('applicationId is required');

    if (!message || typeof message !== 'string' || !message.trim())
      throw new BadRequestException('message must be a non-empty string');

    if (!role)
      throw new BadRequestException('role is required');

    // ===============================
    // Role Validation
    // ===============================
    // if (!allowedRoles.includes(role))
    //   throw new BadRequestException(
    //     `Invalid role. Allowed roles: ${allowedRoles.join(', ')}`
    //   );

    // ===============================
    // ObjectId Validation
    // ===============================
    if (!Types.ObjectId.isValid(userId))
      throw new BadRequestException('Invalid userId format');

    if (!Types.ObjectId.isValid(applicationId))
      throw new BadRequestException('Invalid applicationId format');

    if (!Types.ObjectId.isValid(adminId))
      throw new BadRequestException('Invalid adminId format');

    // ===============================
    // Fetch Admin
    // ===============================
    const admin: any = await this.adminModel
      .findById(adminId)
      .select('_id role fullName email')
      .lean();

    if (!admin)
      throw new NotFoundException('Admin not found');

    // ===============================
    // Fetch User
    // ===============================
    const user: any = await this.userModel
      .findById(userId)
      .select('_id firstName lastName')
      .lean();

    if (!user)
      throw new NotFoundException('User not found');

    // ===============================
    // Validate Application Ownership
    // ===============================
    const application = await this.applicationModel.findOne({
      _id: new Types.ObjectId(applicationId),
      userId: new Types.ObjectId(userId),
    });

    if (!application)
      throw new BadRequestException(
        'Application does not belong to this user'
      );

    // ===============================
    // Prepare Names
    // ===============================
    const userName =
      `${user.firstName || ''} ${user.lastName || ''}`.trim();

    const adminName = admin.fullName || admin.email;

    // ===============================
    // Get or Create Conversation
    // ===============================
    const conversation = await this.getOrCreateConversation(
      userId,
      applicationId,
      adminId,
      role,
      userName,
      adminName,
    );

    // ===============================
    // Prepare Message Object
    // ===============================
    const trimmedMessage = message.trim();

    const newMessage = {
      senderId: new Types.ObjectId(adminId),
      senderType: 'admin',
      senderName: adminName,
      senderRole: role,
      message: trimmedMessage,
      messageType: 'text',
      time: new Date(),
    };

    // ===============================
    // Update Conversation
    // ===============================
    conversation.messages.push(newMessage);
    conversation.lastMessage = trimmedMessage;
    conversation.lastMessageAt = new Date();
    conversation.lastMessageBy = 'admin';
    conversation.unreadUser = (conversation.unreadUser || 0) + 1;
    conversation.unreadAdmin = 0;

    await conversation.save();

    // ===============================
    // Send Notification To User
    // ===============================
    await this.notificationService.sendToUser({
      userId,
      message: `${adminName} replied to your message`,
      stage: 'chat_message',
      type: 'chat',
      applicationId,
    });

    // ===============================
    // Return Response
    // ===============================
    return {
      success: true,
      message: 'Message sent successfully',
      conversationId: conversation._id,
      messageData: newMessage,
    };

  } catch (error) {
    console.error('sendMessageByAdmin error:', error);

    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException
    ) {
      throw error;
    }

    if (error.name === 'CastError') {
      throw new BadRequestException('Invalid ID format');
    }

    throw new InternalServerErrorException(
      'Something went wrong while sending message'
    );
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