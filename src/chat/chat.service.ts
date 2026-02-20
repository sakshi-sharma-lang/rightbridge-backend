import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, Document } from 'mongoose';
import { Conversation } from './schemas/conversation.schema';
import { Application } from '../applications/schemas/application.schema';
import { Admin } from '../admin/schemas/admin.schema';
import { User } from '../users/schemas/user.schema';

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
  ) {}

  // =====================================================
  // CREATE OR GET CONVERSATION (ROLE + ADMIN BASED)
  // =====================================================
  async getOrCreateConversation(
    userId: string,
    applicationId: string,
    role: string,
    adminId: string,
  ) {

    let convo = await this.convoModel.findOne({
      userId: new Types.ObjectId(userId),
      applicationId: new Types.ObjectId(applicationId),
      role,
      adminId: new Types.ObjectId(adminId),
    });

    if (convo) return convo;

    convo = await this.convoModel.create({
      userId: new Types.ObjectId(userId),
      applicationId: new Types.ObjectId(applicationId),
      role,
      adminId: new Types.ObjectId(adminId),
      unreadUser: 0,
      unreadAdmin: 0,
      status: 'open',
      messages: [],
    });

    return convo;
  }

  // =====================================================
  // USER SEND MESSAGE (ROLE + ADMIN BASED)
  // =====================================================
async sendMessageByUser(data: any) {
  const { userId, message, applicationId, adminId } = data;

  if (!userId || !applicationId || !adminId || !message)
    throw new BadRequestException('Missing required fields');

  const user: any = await this.userModel.findById(userId).lean();
  if (!user) throw new BadRequestException('User not found');

  const admin: any = await this.adminModel.findById(adminId).lean();
  if (!admin) throw new BadRequestException('Admin not found');

  if (admin.role === 'viewer')
    throw new BadRequestException('Viewer cannot chat');

  const role = admin.role;

  // 🔥 FIND SAME THREAD FIRST
  let conversation = await this.convoModel.findOne({
    userId: new Types.ObjectId(userId),
    applicationId: new Types.ObjectId(applicationId),
    role,
    adminId: new Types.ObjectId(adminId),
  });

  // 🔥 IF NOT EXIST CREATE
  if (!conversation) {
    conversation = await this.convoModel.create({
      userId: new Types.ObjectId(userId),
      applicationId: new Types.ObjectId(applicationId),
      role,
      adminId: new Types.ObjectId(adminId),
      unreadUser: 0,
      unreadAdmin: 0,
      status: 'open',
      messages: [],
    });
  }

  // 🔥 PUSH IN SAME ARRAY
  conversation.messages.push({
    senderId: new Types.ObjectId(userId),
    senderType: 'user',
    senderName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    senderRole: 'user',
    message,
    messageType: 'text',
    time: new Date(),
    isRead: false,
  });

  conversation.lastMessage = message;
  conversation.lastMessageAt = new Date();
  conversation.lastMessageBy = 'user';
  conversation.unreadAdmin += 1;

  await conversation.save();

  return {
    success: true,
    conversationId: conversation._id,
  };
}

  // =====================================================
  // ADMIN SEND MESSAGE
  // =====================================================
async sendMessageByAdmin(data: any) {
  const { userId, adminId, message, applicationId } = data;

  const admin: any = await this.adminModel.findById(adminId).lean();
  if (!admin) throw new BadRequestException('Admin not found');

  if (admin.role === 'viewer')
    throw new BadRequestException('Viewer cannot send');

  const role = admin.role;

  let conversation = await this.convoModel.findOne({
    userId: new Types.ObjectId(userId),
    applicationId: new Types.ObjectId(applicationId),
    role,
    adminId: new Types.ObjectId(adminId),
  });

  if (!conversation) {
    conversation = await this.convoModel.create({
      userId: new Types.ObjectId(userId),
      applicationId: new Types.ObjectId(applicationId),
      role,
      adminId: new Types.ObjectId(adminId),
      unreadUser: 0,
      unreadAdmin: 0,
      status: 'open',
      messages: [],
    });
  }

  conversation.messages.push({
    senderId: new Types.ObjectId(adminId),
    senderType: 'admin',
    senderName: admin.fullName || admin.email,
    senderRole: role,
    message,
    messageType: 'text',
    time: new Date(),
    isRead: false,
  });

  conversation.lastMessage = message;
  conversation.lastMessageAt = new Date();
  conversation.lastMessageBy = 'admin';
  conversation.unreadUser += 1;
  conversation.unreadAdmin = 0;

  await conversation.save();

  return { success: true };
}

  // =====================================================
  // USER OPEN CHAT
  // =====================================================
async getUserChat(
  userId: string,
  applicationId: string,
  role: string,
  adminId: string,
) {

  const conversation = await this.convoModel.findOne({
    userId: new Types.ObjectId(userId),
    applicationId: new Types.ObjectId(applicationId),
    role,
    adminId: new Types.ObjectId(adminId),
  });

  if (!conversation) return { success: true, data: [] };

  // 🔥 mark admin messages read only for this role
  conversation.messages.forEach((msg: any) => {
    if (msg.senderType === 'admin' && !msg.isRead) {
      msg.isRead = true;
    }
  });

  conversation.unreadUser = 0;
  await conversation.save();

  return {
    success: true,
    data: conversation,
  };
}

  // =====================================================
  // ADMIN OPEN CHAT
  // =====================================================
 async getAdminChat(applicationId: string, role: string, adminId: string) {

  const conversation = await this.convoModel.findOne({
    applicationId: new Types.ObjectId(applicationId),
    role,
    adminId: new Types.ObjectId(adminId),
  });

  if (!conversation) return { success: true, data: [] };

  // 🔥 mark user messages read only for this admin role
  conversation.messages.forEach((msg: any) => {
    if (msg.senderType === 'user' && !msg.isRead) {
      msg.isRead = true;
    }
  });

  conversation.unreadAdmin = 0;
  await conversation.save();

  return {
    success: true,
    data: conversation,
  };
}

  // =====================================================
  // ADMIN SIDEBAR
  // =====================================================
  async getAdminConversations(adminId: string) {
    if (!Types.ObjectId.isValid(adminId))
      throw new BadRequestException('Invalid adminId');

    return this.convoModel
      .find({ adminId: new Types.ObjectId(adminId) })
      .populate('userId', 'firstName lastName email')
      .sort({ updatedAt: -1 });
  }

  // =====================================================
  // USER SIDEBAR
  // =====================================================
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

  // =====================================================
  // USER TOTAL UNREAD
  // =====================================================
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

  // =====================================================
  // ADMIN TOTAL UNREAD
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

  // =====================================================
  // USER APPLICATION LIST
  // =====================================================
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
}