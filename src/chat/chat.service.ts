import { Injectable, BadRequestException ,InternalServerErrorException } from '@nestjs/common';
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

    const conversationKey = `${applicationId}_${adminId}_${userId}`;

    conversation = await this.convoModel.create({
      userId: new Types.ObjectId(userId),
      applicationId: new Types.ObjectId(applicationId),
      adminId: new Types.ObjectId(adminId),
      role,
      conversationKey,
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
    const { userId, message, applicationId, adminId ,senderRole } = data;

    // ==============================
    // 1️⃣ REQUIRED FIELD VALIDATION
    // ==============================
    if (!userId || !applicationId || !adminId || !message) {
      throw new BadRequestException('Missing required fields');
    }
    if (!senderRole) {
  throw new BadRequestException('senderRole is required');
}

    // ==============================
    // 2️⃣ OBJECT ID VALIDATION
    // ==============================
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid userId');
    }

    if (!Types.ObjectId.isValid(applicationId)) {
      throw new BadRequestException('Invalid applicationId');
    }

    if (!Types.ObjectId.isValid(adminId)) {
      throw new BadRequestException('Invalid adminId');
    }

    // ==============================
    // 3️⃣ FETCH USER
    // ==============================
    const user: any = await this.userModel
      .findById(userId)
      .select('_id firstName lastName role')
      .lean();

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // ==============================
    // 4️⃣ FETCH ADMIN
    // ==============================
    const admin: any = await this.adminModel
      .findById(adminId)
      .select('_id role fullName email')
      .lean();

    if (!admin) {
      throw new BadRequestException('Admin not found');
    }

    // ==============================
    // 5️⃣ VALIDATE APPLICATION OWNERSHIP
    // ==============================
    const application = await this.applicationModel.findOne({
      _id: new Types.ObjectId(applicationId),
      userId: new Types.ObjectId(userId),
    });

    if (!application) {
      throw new BadRequestException('Application invalid');
    }

    // ==============================
    // 6️⃣ PREPARE NAMES
    // ==============================
    const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    const adminName = admin.fullName || admin.email;

    // ==============================
    // 7️⃣ GET OR CREATE CONVERSATION
    // ==============================
    const conversation = await this.getOrCreateConversation(
      userId,
      applicationId,
      adminId,
      admin.role,   // 🔒 unchanged
      userName,
      adminName,
    );

    if (!conversation) {
      throw new InternalServerErrorException('Conversation creation failed');
    }

    if (!conversation.messages) {
      conversation.messages = [];
    }

    // ==============================
    // 8️⃣ CREATE MESSAGE
    // ==============================
    const newMessage = {
      senderId: new Types.ObjectId(userId),
      senderType: 'user',
      senderName: userName,
      senderRole: senderRole,
      message,
      messageType: 'text',
      time: new Date(),
    };

    // ==============================
    // 9️⃣ UPDATE CONVERSATION
    // ==============================
    conversation.messages.push(newMessage);
    conversation.lastMessage = message;
    conversation.lastMessageAt = new Date();
    conversation.lastMessageBy = 'user';
    conversation.unreadAdmin = (conversation.unreadAdmin || 0) + 1;

    // ==============================
    // 🔟 SAVE
    // ==============================
    await conversation.save();

    // ==============================
    // RETURN RESPONSE
    // ==============================
    return {
      success: true,
      conversationId: conversation._id,
      messageData: newMessage,
    };

  } catch (error) {

    // ✅ If already an HTTP exception, rethrow it
    if (error instanceof BadRequestException) {
      throw error;
    }

    // Optional: log error for debugging
    console.error('❌ sendMessageByUser Error:', error);

    // Fallback server error
    throw new InternalServerErrorException('Failed to send message');
  }
}
  // =====================================================
  // ADMIN SEND MESSAGE
  // =====================================================
async sendMessageByAdmin(data: any) {
  try {
    const { userId, adminId, message, applicationId  ,senderRole} = data;
    if (!senderRole) {
  throw new BadRequestException('senderRole is required');
}

    // ==============================
    // 1️⃣ REQUIRED FIELD VALIDATION
    // ==============================
    if (!userId || !adminId || !applicationId || !message) {
      throw new BadRequestException('Missing required fields');
    }

    // ==============================
    // 2️⃣ OBJECT ID VALIDATION
    // ==============================
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid userId');
    }

    if (!Types.ObjectId.isValid(adminId)) {
      throw new BadRequestException('Invalid adminId');
    }

    if (!Types.ObjectId.isValid(applicationId)) {
      throw new BadRequestException('Invalid applicationId');
    }

    // ==============================
    // 3️⃣ FETCH ADMIN
    // ==============================
    const admin: any = await this.adminModel
      .findById(adminId)
      .select('_id role fullName email')
      .lean();

    if (!admin) {
      throw new BadRequestException('Admin not found');
    }

    // ==============================
    // 4️⃣ FETCH USER
    // ==============================
    const user: any = await this.userModel
      .findById(userId)
      .select('_id firstName lastName')
      .lean();

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // ==============================
    // 5️⃣ VALIDATE APPLICATION OWNERSHIP
    // ==============================
    const application = await this.applicationModel.findOne({
      _id: new Types.ObjectId(applicationId),
      userId: new Types.ObjectId(userId),
    });

    if (!application) {
      throw new BadRequestException('Application invalid');
    }

    const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    const adminName = admin.fullName || admin.email;

    // ==============================
    // 6️⃣ GET OR CREATE CONVERSATION
    // 🔒 DO NOT CHANGE ROLE LOGIC
    // ==============================
    const conversation = await this.getOrCreateConversation(
      userId,
      applicationId,
      adminId,
      admin.role,
      userName,
      adminName,
    );

    if (!conversation) {
      throw new InternalServerErrorException('Conversation creation failed');
    }

    if (!conversation.messages) {
      conversation.messages = [];
    }

    // ==============================
    // 7️⃣ CREATE MESSAGE
    // ==============================
    const newMessage = {
      senderId: new Types.ObjectId(adminId),
      senderType: 'admin',
      senderName: adminName,
      senderRole: senderRole,
      message,
      messageType: 'text',
      time: new Date(),
    };

    // ==============================
    // 8️⃣ UPDATE CONVERSATION
    // ==============================
    conversation.messages.push(newMessage);
    conversation.lastMessage = message;
    conversation.lastMessageAt = new Date();
    conversation.lastMessageBy = 'admin';

    conversation.unreadUser = (conversation.unreadUser || 0) + 1;
    conversation.unreadAdmin = 0;

    // ==============================
    // 9️⃣ SAVE
    // ==============================
    await conversation.save();

    // ==============================
    // 🔟 RETURN
    // ==============================
    return {
      success: true,
      conversationId: conversation._id,
      messageData: newMessage,
    };

  } catch (error: any) {

  console.error('❌ sendMessageByUser Error:', error);

  // If already HTTP exception → return as is
  if (error instanceof BadRequestException ||
      error instanceof InternalServerErrorException) {
    throw error;
  }

  // ✅ Return exact mongoose validation message
  if (error?.name === 'ValidationError') {
    throw new BadRequestException(error.message);
  }

  // Cast error
  if (error?.name === 'CastError') {
    throw new BadRequestException(error.message);
  }

  // Duplicate key
  if (error?.code === 11000) {
    throw new BadRequestException('Duplicate key error');
  }

  // Fallback
  throw new InternalServerErrorException(error.message || 'Server error');
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