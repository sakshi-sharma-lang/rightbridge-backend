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
  try {
    // =====================================================
    // 1. OBJECT ID VALIDATION
    // =====================================================
    if (!Types.ObjectId.isValid(userId))
      throw new BadRequestException('Invalid userId');

    if (!Types.ObjectId.isValid(applicationId))
      throw new BadRequestException('Invalid applicationId');

    if (!Types.ObjectId.isValid(adminId))
      throw new BadRequestException('Invalid adminId');

    if (!role) throw new BadRequestException('role required');

    // =====================================================
    // 2. CHECK USER EXIST
    // =====================================================
    const user = await this.userModel
      .findById(userId)
      .select('_id firstName lastName')
      .lean();

    if (!user) throw new BadRequestException('User not found');

    // =====================================================
    // 3. CHECK ADMIN EXIST
    // =====================================================
    const admin = await this.adminModel
      .findById(adminId)
      .select('_id role fullName email')
      .lean();

    if (!admin) throw new BadRequestException('Admin not found');

    if (admin.role === 'viewer')
      throw new BadRequestException('Viewer cannot access chat');

    // =====================================================
    // 4. CHECK APPLICATION EXIST + BELONGS TO USER
    // =====================================================
    const application = await this.applicationModel
      .findOne({
        _id: new Types.ObjectId(applicationId),
        userId: new Types.ObjectId(userId), // 🔥 important check
      })
      .select('_id appId status')
      .lean();

    if (!application)
      throw new BadRequestException(
        'Application not found or does not belong to this user',
      );

    // =====================================================
    // 5. FIND EXISTING CONVERSATION
    // =====================================================
    let convo = await this.convoModel.findOne({
      userId: new Types.ObjectId(userId),
      applicationId: new Types.ObjectId(applicationId),
      role,
      adminId: new Types.ObjectId(adminId),
    });

    if (convo) return convo;

    // =====================================================
    // 6. CREATE NEW CONVERSATION
    // =====================================================
    convo = await this.convoModel.create({
      userId: new Types.ObjectId(userId),
      applicationId: new Types.ObjectId(applicationId),
      role,
      adminId: new Types.ObjectId(adminId),

      // optional but useful
      adminName: admin.fullName || admin.email,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),

      unreadUser: 0,
      unreadAdmin: 0,
      status: 'open',
      messages: [],
    });

    return convo;

  } catch (error) {
    console.error('getOrCreateConversation error =>', error);
    throw new BadRequestException(error.message || 'Conversation error');
  }
}

  // =====================================================
  // USER SEND MESSAGE (ROLE + ADMIN BASED)
  // =====================================================
async sendMessageByUser(data: any) {
  try {
    const { userId, message, applicationId } = data;

    // =====================================================
    // 1. BASIC VALIDATION
    // =====================================================
    if (!userId || !applicationId || !message)
      throw new BadRequestException('Missing required fields');

    if (!Types.ObjectId.isValid(userId))
      throw new BadRequestException('Invalid userId');

    if (!Types.ObjectId.isValid(applicationId))
      throw new BadRequestException('Invalid applicationId');

    // =====================================================
    // 2. CHECK USER
    // =====================================================
    const user: any = await this.userModel
      .findById(userId)
      .select('_id firstName lastName email')
      .lean();

    if (!user) throw new BadRequestException('User not found');

    // =====================================================
    // 3. CHECK APPLICATION BELONGS TO USER
    // =====================================================
    const application = await this.applicationModel
      .findOne({
        _id: new Types.ObjectId(applicationId),
        userId: new Types.ObjectId(userId),
      })
      .select('_id')
      .lean();

    if (!application)
      throw new BadRequestException(
        'Application not found or not belongs to user',
      );

    // =====================================================
    // 4. CHECK EXISTING CONVERSATION
    // =====================================================
    let conversation = await this.convoModel.findOne({
      userId: new Types.ObjectId(userId),
      applicationId: new Types.ObjectId(applicationId),
    });

    let admin: any;

    // =====================================================
    // 5. FIRST TIME CHAT → ASSIGN SUPER ADMIN
    // =====================================================
    if (!conversation) {

      admin = await this.adminModel
        .findOne({ role: 'SUPER_ADMIN', status: 'active' })
        .select('_id role fullName email')
        .lean();

      if (!admin)
        throw new BadRequestException('Super admin not found');

      if (admin.role === 'viewer')
        throw new BadRequestException('Viewer cannot chat');

      // 🔥 CREATE CONVERSATION WITH SUPER ADMIN
      conversation = await this.convoModel.create({
        userId: new Types.ObjectId(userId),
        applicationId: new Types.ObjectId(applicationId),
        adminId: admin._id,
        role: admin.role,

        userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        adminName: admin.fullName || admin.email,

        unreadUser: 0,
        unreadAdmin: 0,
        status: 'open',
        messages: [],
      });

      console.log("🔥 FIRST CHAT → SUPER ADMIN ASSIGNED:", admin._id);

    } else {
      // =====================================================
      // 6. EXISTING CHAT → USE SAME ADMIN
      // =====================================================
      admin = await this.adminModel
        .findById(conversation.adminId)
        .select('_id role fullName email')
        .lean();

      if (!admin)
        throw new BadRequestException('Assigned admin not found');
    }

    // =====================================================
    // 7. PUSH USER MESSAGE
    // =====================================================
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

    // unread for admin
    conversation.unreadAdmin = (conversation.unreadAdmin || 0) + 1;

    await conversation.save();

    return {
      success: true,
      conversationId: conversation._id,
      adminId: conversation.adminId,
      message: 'Message sent successfully',
    };

  } catch (error) {
    console.error('sendMessageByUser error =>', error);
    throw new BadRequestException(error.message || 'Send message failed');
  }
}
  // =====================================================
  // ADMIN SEND MESSAGE
  // =====================================================
async sendMessageByAdmin(data: any) {
  try {
    const { userId, adminId, message, applicationId } = data;

    // =====================================================
    // 1. BASIC VALIDATION
    // =====================================================
    if (!userId || !adminId || !applicationId || !message)
      throw new BadRequestException('Missing required fields');

    if (!Types.ObjectId.isValid(userId))
      throw new BadRequestException('Invalid userId');

    if (!Types.ObjectId.isValid(adminId))
      throw new BadRequestException('Invalid adminId');

    if (!Types.ObjectId.isValid(applicationId))
      throw new BadRequestException('Invalid applicationId');

    // =====================================================
    // 2. CHECK ADMIN
    // =====================================================
    const admin: any = await this.adminModel
      .findById(adminId)
      .select('_id role fullName email')
      .lean();

    if (!admin) throw new BadRequestException('Admin not found');

    if (admin.role === 'viewer')
      throw new BadRequestException('Viewer cannot send');

    const role = admin.role;

    // =====================================================
    // 3. CHECK USER EXIST
    // =====================================================
    const user: any = await this.userModel
      .findById(userId)
      .select('_id firstName lastName')
      .lean();

    if (!user) throw new BadRequestException('User not found');

    // =====================================================
    // 4. CHECK APPLICATION BELONGS TO USER 🔥 IMPORTANT
    // =====================================================
    const application = await this.applicationModel
      .findOne({
        _id: new Types.ObjectId(applicationId),
        userId: new Types.ObjectId(userId),
      })
      .select('_id')
      .lean();

    if (!application)
      throw new BadRequestException(
        'Application not found or not belongs to user',
      );

    // =====================================================
    // 5. FIND CONVERSATION
    // =====================================================
    let conversation = await this.convoModel.findOne({
      userId: new Types.ObjectId(userId),
      applicationId: new Types.ObjectId(applicationId),
      role,
      adminId: new Types.ObjectId(adminId),
    });

    // =====================================================
    // 6. CREATE IF NOT EXIST
    // =====================================================
    if (!conversation) {
      conversation = await this.convoModel.create({
        userId: new Types.ObjectId(userId),
        applicationId: new Types.ObjectId(applicationId),
        role,
        adminId: new Types.ObjectId(adminId),

        userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        adminName: admin.fullName || admin.email,

        unreadUser: 0,
        unreadAdmin: 0,
        status: 'open',
        messages: [],
      });
    }

    // =====================================================
    // 7. PUSH MESSAGE
    // =====================================================
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

    // unread for user
    conversation.unreadUser = (conversation.unreadUser || 0) + 1;

    // reset admin unread
    conversation.unreadAdmin = 0;

    await conversation.save();

    return {
      success: true,
      message: 'Admin message sent',
      conversationId: conversation._id,
    };

  } catch (error) {
    console.error('sendMessageByAdmin error =>', error);
    throw new BadRequestException(error.message || 'Send failed');
  }
}
  // =====================================================
  // USER OPEN CHAT
  // =====================================================
async getUserChat(userId: string, applicationId: string) {
  try {

    // =====================================================
    // 1. VALIDATION
    // =====================================================
    if (!Types.ObjectId.isValid(userId))
      throw new BadRequestException('Invalid userId');

    if (!Types.ObjectId.isValid(applicationId))
      throw new BadRequestException('Invalid applicationId');

    // =====================================================
    // 2. FIND CONVERSATION (AUTO ADMIN + ROLE)
    // =====================================================
    const conversation = await this.convoModel.findOne({
      userId: new Types.ObjectId(userId),
      applicationId: new Types.ObjectId(applicationId),
    });

    if (!conversation) {
      return {
        success: true,
        data: [],
        message: 'No chat found yet'
      };
    }

    // =====================================================
    // 3. MARK ADMIN MSG READ
    // =====================================================
    let updated = false;

    conversation.messages.forEach((msg: any) => {
      if (msg.senderType === 'admin' && !msg.isRead) {
        msg.isRead = true;
        updated = true;
      }
    });

    if (updated) {
      conversation.unreadUser = 0;
      await conversation.save();
    }

    // =====================================================
    // 4. RETURN CHAT WITH ADMIN + ROLE
    // =====================================================
    return {
      success: true,
      adminId: conversation.adminId,   // frontend now knows admin
      role: conversation.role,         // role-based safe
      data: conversation,
    };

  } catch (error) {
    console.error('getUserChat error =>', error);
    throw new BadRequestException(error.message || 'Chat fetch failed');
  }
}

  // =====================================================
  // ADMIN OPEN CHAT
  // =====================================================
async getAdminChat(applicationId: string, role: string, adminId: string) {
  try {

    // =====================================================
    // 1. VALIDATE IDS
    // =====================================================
    if (!Types.ObjectId.isValid(applicationId))
      throw new BadRequestException('Invalid applicationId');

    if (!Types.ObjectId.isValid(adminId))
      throw new BadRequestException('Invalid adminId');

    if (!role)
      throw new BadRequestException('role required');

    // =====================================================
    // 2. CHECK ADMIN EXISTS
    // =====================================================
    const admin: any = await this.adminModel
      .findById(adminId)
      .select('_id role fullName')
      .lean();

    if (!admin)
      throw new BadRequestException('Admin not found');

    // 🔥 SECURITY: ignore frontend role, use DB role
    const adminRole = admin.role;

    if (adminRole === 'viewer')
      throw new BadRequestException('Viewer cannot access chat');

    // =====================================================
    // 3. CHECK APPLICATION EXISTS
    // =====================================================
    const application = await this.applicationModel
      .findById(applicationId)
      .select('_id userId')
      .lean();

    if (!application)
      throw new BadRequestException('Application not found');

    // =====================================================
    // 4. FIND CONVERSATION
    // =====================================================
    const conversation = await this.convoModel.findOne({
      applicationId: new Types.ObjectId(applicationId),
      role: adminRole,
      adminId: new Types.ObjectId(adminId),
    });

    if (!conversation)
      return { success: true, data: [] };

    // =====================================================
    // 5. MARK USER MESSAGES READ
    // =====================================================
    let updated = false;

    conversation.messages.forEach((msg: any) => {
      if (msg.senderType === 'user' && !msg.isRead) {
        msg.isRead = true;
        updated = true;
      }
    });

    if (updated) {
      conversation.unreadAdmin = 0;
      await conversation.save();
    }

    return {
      success: true,
      data: conversation,
    };

  } catch (error) {
    console.error('getAdminChat error =>', error);
    throw new BadRequestException(error.message || 'Failed to load chat');
  }
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