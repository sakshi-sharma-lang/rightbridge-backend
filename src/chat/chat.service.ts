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
  // GET OR CREATE CONVERSATION
  // =====================================================
  async getOrCreateConversation(
    userId: string,
    applicationId?: string,
  ): Promise<any> {
    if (!Types.ObjectId.isValid(userId))
      throw new BadRequestException('Invalid userId');

    const filter: any = {
      userId: new Types.ObjectId(userId),
    };

    // optional application filter
    if (applicationId && Types.ObjectId.isValid(applicationId)) {
      filter.applicationId = new Types.ObjectId(applicationId);
    }

    let convo = await this.convoModel.findOne(filter);

   if (!convo) {
      const createData: any = {
        userId: new Types.ObjectId(userId),
        unreadUser: 0,
        unreadAdmin: 0,
        status: 'open',
      };

      if (applicationId && Types.ObjectId.isValid(applicationId)) {
        createData.applicationId = new Types.ObjectId(applicationId);
      }

      convo = (await this.convoModel.create(createData)) as any;
    }


    return convo;
  }

  // =====================================================
  // SEND MESSAGE
  // =====================================================
  async saveMessage(data: any) {
    if (!data) throw new BadRequestException('Body required');

    const { userId, adminId, message, senderRole, applicationId } = data;

    if (!userId) throw new BadRequestException('userId required');
    if (!message || message.trim() === '')
      throw new BadRequestException('Message empty');

    if (!Types.ObjectId.isValid(userId))
      throw new BadRequestException('Invalid userId');

    if (senderRole === 'admin') {
      if (!adminId) throw new BadRequestException('adminId required');
      if (!Types.ObjectId.isValid(adminId))
        throw new BadRequestException('Invalid adminId');
    }

    let senderType: 'admin' | 'user';
    let senderId: string;

    if (senderRole === 'admin') {
      senderType = 'admin';
      senderId = adminId;
    } else {
      senderType = 'user';
      senderId = userId;
    }

    // get conversation
    const conversation = await this.getOrCreateConversation(
      userId,
      applicationId,
    );

    if (!conversation) {
      throw new BadRequestException('Conversation not created');
    }

    // save message
    const msg = await this.msgModel.create({
      conversationId: conversation._id,
      senderId: new Types.ObjectId(senderId),
      senderType,
      message: message.trim(),
      messageType: 'text',
      isRead: false,
    });

    // update header
    conversation.lastMessage = message.trim();
    conversation.lastMessageAt = new Date();

    if (senderType === 'admin') conversation.unreadUser += 1;
    else conversation.unreadAdmin += 1;

    // auto assign admin first reply
    if (!conversation.assignedAdmin && senderType === 'admin') {
      conversation.assignedAdmin = new Types.ObjectId(adminId);
    }

    await conversation.save();

    return msg;
  }

  // =====================================================
  // GET FULL CHAT HISTORY
  // =====================================================
  async getMessages(conversationId: string) {
    if (!Types.ObjectId.isValid(conversationId))
      throw new BadRequestException('Invalid conversationId');

    return this.msgModel
      .find({ conversationId: new Types.ObjectId(conversationId) })
      .sort({ createdAt: 1 });
  }

  // =====================================================
  // ADMIN PANEL ALL CHATS
  // =====================================================
  async getAdminConversations() {
    return this.convoModel
      .find()
      .populate('userId', 'firstName lastName email')
      .populate('assignedAdmin', 'name email')
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
      .sort({ updatedAt: -1 });
  }
}
