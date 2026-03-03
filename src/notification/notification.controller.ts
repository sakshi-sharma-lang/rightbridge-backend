import {
  Controller,
  Get,
  Patch,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // ================= ADMIN =================
  @UseGuards(AdminJwtGuard)
  @Get('admin')
  getAdmin(@Req() req: any) {
    return this.notificationService.getAdminNotifications(req.user.id);
  }

  @UseGuards(AdminJwtGuard)
  @Patch('admin/read/:notificationId')
  markAdminRead(@Param('notificationId') id: string, @Req() req: any) {
    return this.notificationService.markAdminRead(id, req.user.id);
  }

  // ================= USER =================
  @UseGuards(JwtAuthGuard)
  @Get('user')
  getUser(@Req() req: any) {
    return this.notificationService.getUserNotifications(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('user/read/:notificationId')
  markUserRead(@Param('notificationId') id: string, @Req() req: any) {
    return this.notificationService.markUserRead(id, req.user.id);
  }
}