import { Controller, Get, Param, Post, Body, UseGuards ,Query} from '@nestjs/common';
import { ChatService } from './chat.service';
import { AdminService } from '../admin/admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';

@Controller()
export class ChatController {
  constructor(
    private chatService: ChatService,
    private adminService: AdminService,
  ) {}

  // =====================================================
  // USER SEND MESSAGE
  // =====================================================
  @UseGuards(JwtAuthGuard)
  @Post('user/chat/send')
  async sendUserMessage(@Body() body: any) {
    return this.chatService.sendMessageByUser(body);
  }

  // =====================================================
  // ADMIN SEND MESSAGE
  // =====================================================
  @UseGuards(AdminJwtGuard)
  @Post('admin/chat/send')
  async sendAdminMessage(@Body() body: any) {
    return this.chatService.sendMessageByAdmin(body);
  }

  // =====================================================
  // USER TOTAL UNREAD
  // =====================================================
  @UseGuards(JwtAuthGuard)
  @Get('user/chat-total-unread/:userId')
  async userTotalUnread(@Param('userId') userId: string) {
    return this.chatService.getUserTotalUnread(userId);
  }

  // =====================================================
  // ADMIN TOTAL UNREAD
  // =====================================================
  @UseGuards(AdminJwtGuard)
  @Get('admin/chat-total-unread/:adminId')
  async adminTotalUnread(@Param('adminId') adminId: string) {
    return this.chatService.getAdminTotalUnread(adminId);
  }

  // =====================================================
  // ADMIN SIDEBAR
  // =====================================================
@UseGuards(AdminJwtGuard)
@Get('admin/chat/:adminId')
async getAdminConversation(
  @Param('adminId') adminId: string,
  @Query('applicationId') applicationId: string,
) {
  return this.chatService.getAdminConversation(adminId, applicationId);
}
  // =====================================================
  // USER SIDEBAR
  // =====================================================
  @UseGuards(JwtAuthGuard)
  @Get('user/chat/sidebar/:userId/:applicationId')
  async getUserConversations(
    @Param('userId') userId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.chatService.getUserConversations(userId, applicationId);
  }

  // =====================================================
  // USER OPEN CHAT
  // =====================================================
  @UseGuards(JwtAuthGuard)
  @Get('user/chat/open/:userId/:applicationId/:role')
  async getUserChat(
    @Param('userId') userId: string,
    @Param('applicationId') applicationId: string,
    @Param('role') role: string,
  ) {
    return this.chatService.getUserChat(userId, applicationId, role);
  }

  // =====================================================
  // ADMIN OPEN CHAT
  // =====================================================
  @UseGuards(AdminJwtGuard)
  @Get('admin/chat/open/:applicationId/:role/:adminId')
  async getAdminChat(
    @Param('applicationId') applicationId: string,
    @Param('role') role: string,
    @Param('adminId') adminId: string,
  ) {
    return this.chatService.getAdminChat(applicationId, role, adminId);
  }

  // =====================================================
  // USER APPLICATIONS
  // =====================================================
  @UseGuards(JwtAuthGuard)
  @Get('user/applications/:userId')
  async getUserApplications(@Param('userId') userId: string) {
    return this.chatService.getApplicationsByUserId(userId);
  }

  // =====================================================
  // SUPERADMIN (Already Protected)
  // =====================================================
  @UseGuards(JwtAuthGuard)
  @Get('superadmin')
  async getSuperAdmin() {
    return this.adminService.getSuperAdmin();
  }
}