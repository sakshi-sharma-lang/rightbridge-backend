import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';

@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
  ) {}

  // ==========================================
  // ADMIN GET NOTIFICATIONS
  // GET: /notifications/admin/:adminId
  // ==========================================
  @UseGuards(AdminJwtGuard)
  @Get('admin/:adminId')
  async getAdminNotifications(
    @Param('adminId') adminId: string,
  ) {
    return this.notificationService.getAdminNotifications(adminId);
  }

  // ==========================================
  // USER GET NOTIFICATIONS
  // GET: /notifications/user/:userId
  // ==========================================
  @UseGuards(JwtAuthGuard)
  @Get('user/:userId')
  async getUserNotifications(
    @Param('userId') userId: string,
  ) {
    return this.notificationService.getUserNotifications(userId);
  }

  // ==========================================
  // USER MARK READ
  // PATCH: /notifications/user/read/:notificationId/:userId
  // ==========================================
@UseGuards(JwtAuthGuard)
@Patch('user/read/:userId')
async markUserRead(
  @Param('userId') userId: string,
) {
  return this.notificationService.markUserRead(userId);
}

  // ==========================================
  // ADMIN MARK READ
  // PATCH: /notifications/admin/read/:notificationId/:adminId
  // ==========================================
@UseGuards(AdminJwtGuard)
@Patch('admin/read/:adminId')
async markAdminRead(
  @Param('adminId') adminId: string,
) {
  return this.notificationService.markAdminRead(adminId);
}
}