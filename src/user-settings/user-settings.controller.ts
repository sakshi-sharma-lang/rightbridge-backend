import { Controller, Get, Patch, Post, Delete, Body, Req, UseGuards } from '@nestjs/common';
import { UserSettingsService } from './user-settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('user-settings')
export class UserSettingsController {
  constructor(private readonly service: UserSettingsService) {}

  @Get()
  getSettings(@Req() req) {
    console.log('JWT USER =>', req.user);
    return this.service.getSettings(req.user.userId || req.user._id);
  }

  @Patch('notifications')
  updateNotifications(@Req() req, @Body() body) {
    return this.service.updateNotifications(req.user.userId || req.user._id, body);
  }

  @Post('change-password')
  changePassword(@Req() req, @Body() body) {
    console.log('JWT USER =>', req.user);
    return this.service.changePassword(req.user.userId || req.user._id, body);
  }

  // @Delete('admin/delete-account')
  // deleteAccount(@Req() req) {
  //   return this.service.deleteAccount(req.user.userId || req.user._id);
  // }

  //  @Delete('delete-account/request')
  // deleteAccountRequestUser(@Req() req) {
  //   return this.service.deleteAccountRequestUser(req.user.userId || req.user._id);
  // }
}
