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
  // USER NOTIFICATION (SAVE DB + REALTIME)
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
      console.log("🔥 sendToUser CALLED:", userId);

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
        isRead: false,
      });

      console.log("✅ Notification saved:", notification._id);

      const payload = {
        id: notification._id,
        message,
        stage,
        type,
        applicationId,
        isRead: false,
        createdAt: notification.createdAt,
      };

      // realtime socket
      this.chatGateway.sendNotificationToUser(userId, payload);

      return {
        success: true,
        message: 'Notification sent to user',
        data: notification,
      };
    } catch (error) {
      console.error('❌ FULL USER ERROR:', error);
      return {
        success: false,
        message: error.message || 'Failed to send user notification',
      };
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
      console.log("🔥 sendToAdmin CALLED:", adminId);

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
        isRead: false,
      });

      console.log("✅ Admin notification saved:", notification._id);

      const payload = {
        id: notification._id,
        message,
        stage,
        type,
        applicationId,
        isRead: false,
        createdAt: notification.createdAt,
      };

      // realtime socket
      this.chatGateway.sendNotificationToAdmin(adminId, payload);

      return {
        success: true,
        message: 'Notification sent to admin',
        data: notification,
      };
    } catch (error) {
      console.error('❌ FULL ADMIN ERROR:', error);
      return {
        success: false,
        message: error.message || 'Failed to send admin notification',
      };
    }
  }

  // =====================================================
  // GET ADMIN NOTIFICATIONS
  // =====================================================
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
  async markRead(notificationId: string) {
    try {
      if (!Types.ObjectId.isValid(notificationId)) {
        throw new Error('Invalid notificationId');
      }

      const updated = await this.notificationModel.findByIdAndUpdate(
        notificationId,
        { isRead: true },
        { new: true },
      );

      return {
        success: true,
        message: 'Notification marked as read',
        data: updated,
      };
    } catch (error) {
      console.error('markRead error:', error.message);
      return {
        success: false,
        message: error.message || 'Failed to mark notification read',
      };
    }
  }
}