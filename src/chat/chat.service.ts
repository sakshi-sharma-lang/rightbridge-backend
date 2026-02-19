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
  // CREATE OR GET CONVERSATION
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

    // 🔥 CHECK APPLICATION EXISTS + BELONGS TO USER
    const appExists = await this.applicationModel.exists({
      _id: appObj,
      userId: userObj,
    });

    if (!appExists) {
      throw new BadRequestException(
        'Invalid applicationId or this application does not belong to user',
      );
    }

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

    const user = await this.userModel.findById(userId).lean();
    if (!user) throw new BadRequestException('User not found');

    // 🔥 CHECK APPLICATION EXISTS
    const application = await this.applicationModel.findById(applicationId).lean();
    if (!application) throw new BadRequestException('Application not found');

    // 🔥 CHECK APPLICATION BELONGS TO USER
    if (application.userId.toString() !== userId.toString()) {
      throw new BadRequestException(
        'This application does not belong to this user',
      );
    }

    const conversation = await this.getOrCreateConversation(userId, applicationId);

    // assign super admin first time
    if (!conversation.assignedAdmin) {
      const superAdmin = await this.adminModel.findOne({ role: 'super_admin' });
      if (!superAdmin) throw new BadRequestException('Super admin not found');
      conversation.assignedAdmin = superAdmin._id;
    }

    conversation.messages.push({
      senderId: new Types.ObjectId(userId),
      senderType: 'user',
      senderName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      senderRole: 'user',
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
      message: lastMsg,
      conversationId: conversation._id,
      unreadAdmin: conversation.unreadAdmin,
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

    const admin: any = await this.adminModel.findById(adminId).lean();
    if (!admin) throw new BadRequestException('Admin not found');

   
    // if (!['admin', 'super_admin'].includes(admin.role)) {
    //   throw new BadRequestException('You are not allowed to send messages');
    // }

    const application = await this.applicationModel.findById(applicationId).lean();
    if (!application) throw new BadRequestException('Application not found');

    
    if (application.userId.toString() !== userId.toString()) {
      throw new BadRequestException(
        'This user does not belong to this application',
      );
    }

    const adminName =
      `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || 'Admin';

    const adminRole = admin.role || 'admin';

    const conversation = await this.getOrCreateConversation(userId, applicationId);

    conversation.messages.push({
      senderId: new Types.ObjectId(adminId),
      senderType: 'admin',
      senderName: adminName,
      senderRole: adminRole,
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
      message: lastMsg,
      conversationId: conversation._id,
      unreadUser: conversation.unreadUser,
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

    if (updated) await conversation.save();

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
  async getUserConversations(applicationId: string) {
    if (!Types.ObjectId.isValid(applicationId))
      throw new BadRequestException('Invalid applicationId');

    return this.convoModel
      .find({ applicationId: new Types.ObjectId(applicationId) })
      .populate('assignedAdmin', 'firstName lastName email')
      .sort({ updatedAt: -1 });
  }

  // =====================================================
  // ADMIN TOTAL UNREAD
  // =====================================================
  async getAdminTotalUnread() {
    try {
      const unreadAgg = await this.convoModel.aggregate([
        { $group: { _id: null, total: { $sum: '$unreadAdmin' } } },
      ]);

      const totalUnread = unreadAgg[0]?.total || 0;

      const unreadMessages = await this.convoModel
        .find({ unreadAdmin: { $gt: 0 } })
        .select('messages')
        .lean();

      let messages: any[] = [];
      unreadMessages.forEach((c) => {
        if (c.messages?.length) {
          messages.push(...c.messages.filter((m) => !m.isRead));
        }
      });

      return {
        success: true,
        message: 'Admin unread fetched successfully',
        totalUnread,
        messages,
      };
    } catch (error) {
      console.error('ADMIN UNREAD ERROR:', error);

      return {
        success: false,
        message: 'Failed to fetch unread messages',
        totalUnread: 0,
        messages: [],
      };
    }
  }

  // =====================================================
  // USER TOTAL UNREAD
  // =====================================================
  async getUserTotalUnread(userId: string) {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid userId');
      }

      const objectUserId = new Types.ObjectId(userId);

      const result = await this.convoModel.aggregate([
        { $match: { userId: objectUserId } },
        { $group: { _id: null, total: { $sum: '$unreadUser' } } },
      ]);

      const totalUnread = result[0]?.total || 0;

      const conversations = await this.convoModel
        .find({ userId: objectUserId, unreadUser: { $gt: 0 } })
        .select('messages applicationId')
        .lean();

      let unreadMessages: any[] = [];

      conversations.forEach((conv) => {
        if (conv.messages?.length) {
          const msgs = conv.messages
            .filter((m) => m.senderType === 'admin' && !m.isRead)
            .map((m) => ({
              ...m,
              applicationId: conv.applicationId || null,
            }));

          unreadMessages.push(...msgs);
        }
      });

      return {
        success: true,
        message: 'User unread fetched successfully',
        totalUnread,
        messages: unreadMessages,
      };
    } catch (error) {
      console.error('USER UNREAD ERROR:', error);

      return {
        success: false,
        message: 'Failed to fetch unread messages',
        totalUnread: 0,
        messages: [],
      };
    }
  }

  // =====================================================
  // GET APPLICATIONS OF USER
  // =====================================================
  async getApplicationsByUserId(userId: string) {
    try {
      if (!userId || !Types.ObjectId.isValid(userId)) {
        return {
          statusCode: 400,
          message: 'Valid userId is required',
          data: [],
        };
      }

      const applications = await this.applicationModel
        .find({ userId: new Types.ObjectId(userId) })
        .select('_id appId status applicationStatus createdAt')
        .sort({ createdAt: -1 })
        .lean();

      if (!applications.length) {
        return {
          statusCode: 404,
          message: 'No applications found for this user',
          data: [],
        };
      }

      const formatted = applications.map((app: any) => ({
        applicationId: app._id,
        appId: app.appId || '',
        status: app.status || '',
        stage: app.applicationStatus || '',
        createdAt: app.createdAt,
      }));

      return {
        statusCode: 200,
        message: 'User applications fetched successfully',
        total: formatted.length,
        data: formatted,
      };
    } catch (error) {
      console.error('GET USER APPLICATION ERROR:', error);

      return {
        statusCode: 500,
        message: 'Internal server error',
        data: [],
      };
    }
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

}
