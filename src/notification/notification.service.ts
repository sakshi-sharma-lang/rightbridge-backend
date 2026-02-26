import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema';
import { Model, Types } from 'mongoose';
import { ChatGateway } from '../chat/chat.gateway';

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    private chatGateway: ChatGateway,
  ) {}

  // =====================================================
  // USER NOTIFICATION (DB + REALTIME)
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

    // 1. SAVE IN DB (always)
    const notification: NotificationDocument =
  await this.notificationModel.create({
      userId: new Types.ObjectId(userId),
      message,
      stage,
      type,
      applicationId: applicationId ? new Types.ObjectId(applicationId) : null,
      isRead: false,
    });

    // 2. REALTIME SEND IF ONLINE
    const payload = {
      id: notification._id,
      message,
      stage,
      type,
      applicationId,
      isRead: false,
      createdAt: notification.createdAt,
    };

    this.chatGateway.sendNotificationToUser(userId, payload);

    return notification;
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

    const notification: NotificationDocument =
  await this.notificationModel.create({
      adminId: new Types.ObjectId(adminId),
      message,
      stage,
      type,
      applicationId: applicationId ? new Types.ObjectId(applicationId) : null,
      isRead: false,
    });

    const payload = {
      id: notification._id,
      message,
      stage,
      type,
      applicationId,
      isRead: false,
      createdAt: notification.createdAt,
    };

    this.chatGateway.sendNotificationToAdmin(adminId, payload);

    return notification;
  }
}