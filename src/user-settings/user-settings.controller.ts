import { Controller, Get, Patch, Post, Delete, Body, Req, UseGuards ,Param  ,Query} from '@nestjs/common';
import { UserSettingsService } from './user-settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
@Controller('user-settings')
export class UserSettingsController {
  constructor(private readonly service: UserSettingsService) {}
@UseGuards(JwtAuthGuard)
  @Get()
  getSettings(@Req() req) {
    console.log('JWT USER =>', req.user);
    return this.service.getSettings(req.user.userId || req.user._id);
  }
@UseGuards(JwtAuthGuard)
  @Patch('notifications')
 updateNotifications(
  @Req() req,
  @Body() dto: UpdateNotificationSettingsDto,
) {
  const userId = req.user.userId || req.user._id;
  return this.service.updateNotifications(userId, dto);
}
@UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(@Req() req, @Body() body) {
    console.log('JWT USER =>', req.user);
    return this.service.changePassword(req.user.userId || req.user._id, body);
  }

  @Delete('admin/delete-account/:userId')
  @UseGuards(AdminJwtGuard)
  deleteAccount(@Param('userId') userId: string) {
    console.log('PARAM USERID =>', userId);
    return this.service.deleteAccount(userId);
  }
@UseGuards(JwtAuthGuard)
   @Delete('delete-account/request')
  deleteAccountRequestUser(@Req() req) {
    return this.service.deleteAccountRequestUser(req.user.userId || req.user._id);
  }

  @UseGuards(AdminJwtGuard)
  @Get('dangerzone-status')
  async getDangerzoneStatus(@Query('userId') userId: string) {
    return this.service.getDangerzoneStatus(userId);
  }
}
