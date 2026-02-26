import { Controller, Get, Patch, Param } from '@nestjs/common';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // ADMIN
  @Get('admin/:adminId')
  getAdmin(@Param('adminId') adminId: string) {
    return this.notificationService.getAdminNotifications(adminId);
  }

  // USER (userId + applicationId)
  @Get('user/:userId')
  getUser(@Param('userId') userId: string) {
    return this.notificationService.getUserNotifications(userId);
  }
  // MARK READ
  @Patch('read/:notificationId')
  markRead(@Param('notificationId') id: string) {
    return this.notificationService.markRead(id);
  }
}