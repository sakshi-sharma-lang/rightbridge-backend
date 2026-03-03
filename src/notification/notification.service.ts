import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema';
import { Model, Types } from 'mongoose';
import { ChatGateway } from '../chat/chat.gateway';

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,

    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
  ) {}

  // =====================================================
  // USER NOTIFICATION
  // =====================================================
  async sendToUser({
    userId,
    message,
    stage,
    type = 'general',
    applicationId = null,
  }: {
    userId: string;
    message: string;
    stage: string;
    type?: string;
    applicationId?: string | null;
  }) {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid userId');
      }

      const notification = await this.notificationModel.create({
        userId: new Types.ObjectId(userId),
        message,
        stage,
        type,
        applicationId: applicationId
          ? new Types.ObjectId(applicationId)
          : null,
        isReadByUser: false,
        isReadByAdmin: true,
      });

      const payload = {
        id: notification._id,
        message,
        stage,
        type,
        applicationId,
        isReadByUser: false,
        createdAt: notification.createdAt,
      };

      // ✅ correct new method
      this.chatGateway.sendOtherNotificationToUser(userId, payload);

      return { success: true, data: notification };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // =====================================================
  // ADMIN NOTIFICATION
  // =====================================================
  async sendToAdmin({
    adminId,
    message,
    stage,
    type = 'admin',
    applicationId = null,
  }: {
    adminId: string;
    message: string;
    stage: string;
    type?: string;
    applicationId?: string | null;
  }) {
    try {
      if (!Types.ObjectId.isValid(adminId)) {
        throw new Error('Invalid adminId');
      }

      const notification = await this.notificationModel.create({
        adminId: new Types.ObjectId(adminId),
        message,
        stage,
        type,
        applicationId: applicationId
          ? new Types.ObjectId(applicationId)
          : null,
        isReadByAdmin: false,
        isReadByUser: true,
      });

      const payload = {
        id: notification._id,
        message,
        stage,
        type,
        applicationId,
        isReadByAdmin: false,
        createdAt: notification.createdAt,
      };

      // ✅ correct new method
      this.chatGateway.sendOtherNotificationToAdmin(adminId, payload);

      return { success: true, data: notification };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // =====================================================
  // MARK ALL USER READ
  // =====================================================
  async markAllUserRead(userId: string) {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid userId');
      }

      const result = await this.notificationModel.updateMany(
        {
          userId: new Types.ObjectId(userId),
          isReadByUser: false,
        },
        { $set: { isReadByUser: true } },
      );

      return { success: true, modifiedCount: result.modifiedCount };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // =====================================================
  // MARK ALL ADMIN READ
  // =====================================================
  async markAllAdminRead(adminId: string) {
    try {
      if (!Types.ObjectId.isValid(adminId)) {
        throw new Error('Invalid adminId');
      }

      const result = await this.notificationModel.updateMany(
        {
          adminId: new Types.ObjectId(adminId),
          isReadByAdmin: false,
        },
        { $set: { isReadByAdmin: true } },
      );

      return { success: true, modifiedCount: result.modifiedCount };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

    async getAdminNotifications(adminId: string) {
    try {
      if (!Types.ObjectId.isValid(adminId)) {
        throw new Error('Invalid adminId');
      }

      const data = await this.notificationModel
        .find({ adminId: new Types.ObjectId(adminId) })
        .sort({ createdAt: -1 });

      return {
        success: true,
        message: 'Admin notifications fetched',
        data,
      };
    } catch (error) {
      console.error('getAdminNotifications error:', error.message);
      return {
        success: false,
        message: error.message || 'Failed to fetch admin notifications',
      };
    }
  }

  // =====================================================
  // GET USER NOTIFICATIONS
  // =====================================================
  async getUserNotifications(userId: string) {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid userId');
      }

      const data = await this.notificationModel
        .find({ userId: new Types.ObjectId(userId) })
        .sort({ createdAt: -1 });

      return {
        success: true,
        message: 'User notifications fetched',
        data,
      };
    } catch (error) {
      console.error('getUserNotifications error:', error.message);
      return {
        success: false,
        message: error.message || 'Failed to fetch user notifications',
      };
    }
  }

  // =====================================================
  // MARK READ
  // =====================================================
 


  // =====================================================
  async markUserRead(notificationId: string, userId: string) {
    try {
      if (
        !Types.ObjectId.isValid(notificationId) ||
        !Types.ObjectId.isValid(userId)
      ) {
        throw new Error('Invalid ID');
      }

      const updated = await this.notificationModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(notificationId),
          userId: new Types.ObjectId(userId),
          adminId: { $exists: false },
        },
        { isReadByUser: true },
        { new: true },
      );

      if (!updated) {
        throw new Error('Notification not found or unauthorized');
      }

      return {
        success: true,
        message: 'User notification marked as read',
        data: updated,
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // =====================================================
  // MARK SINGLE ADMIN READ
  // =====================================================
  async markAdminRead(notificationId: string, adminId: string) {
    try {
      if (
        !Types.ObjectId.isValid(notificationId) ||
        !Types.ObjectId.isValid(adminId)
      ) {
        throw new Error('Invalid ID');
      }

      const updated = await this.notificationModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(notificationId),
          adminId: new Types.ObjectId(adminId),
        },
        { isReadByAdmin: true },
        { new: true },
      );

      if (!updated) {
        throw new Error('Notification not found or unauthorized');
      }

      return {
        success: true,
        message: 'Admin notification marked as read',
        data: updated,
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // =====================================================
  // MARK ALL USER READ
  // =====================================================
 

  // =====================================================
  // MARK ALL ADMIN READ
  // =====================================================
 
}