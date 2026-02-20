import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller()
export class ChatController {
  constructor(private chatService: ChatService) {}

  // =====================================================
  // USER SEND MESSAGE
  // body: userId, applicationId, role, adminId, message
  // =====================================================
  @Post('user/chat/send')
  async sendUserMessage(@Body() body: any) {
    return this.chatService.sendMessageByUser(body);
  }

  // =====================================================
  // ADMIN SEND MESSAGE
  // body: adminId, applicationId, role, userId, message
  // =====================================================
  @Post('admin/chat/send')
  async sendAdminMessage(@Body() body: any) {
    return this.chatService.sendMessageByAdmin(body);
  }

  // =====================================================
  // USER TOTAL UNREAD
  // =====================================================
  @Get('user/chat-total-unread/:userId')
  async userTotalUnread(@Param('userId') userId: string) {
    return this.chatService.getUserTotalUnread(userId);
  }

  // =====================================================
  // ADMIN TOTAL UNREAD
  // =====================================================
  @Get('admin/chat-total-unread/:adminId')
  async adminTotalUnread(@Param('adminId') adminId: string) {
    return this.chatService.getAdminTotalUnread(adminId);
  }

  // =====================================================
  // ADMIN SIDEBAR (ALL CHATS OF THIS ADMIN)
  // =====================================================
  @Get('admin/chat/:adminId')
  async getAdminConversations(@Param('adminId') adminId: string) {
    return this.chatService.getAdminConversations(adminId);
  }

  // =====================================================
  // USER SIDEBAR (ALL ROLES OF APPLICATION)
  // =====================================================
  @Get('user/chat/sidebar/:userId/:applicationId')
  async getUserConversations(
    @Param('userId') userId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.chatService.getUserConversations(userId, applicationId);
  }

  // =====================================================
  // USER OPEN CHAT (VERY IMPORTANT)
  // =====================================================
  @Get('user/chat/open/:userId/:applicationId/:role/:adminId')
  async getUserChat(
    @Param('userId') userId: string,
    @Param('applicationId') applicationId: string,
    @Param('role') role: string,
    @Param('adminId') adminId: string,
  ) {
    return this.chatService.getUserChat(userId, applicationId, role, adminId);
  }

  // =====================================================
  // ADMIN OPEN CHAT
  // =====================================================
  @Get('admin/chat/open/:applicationId/:role/:adminId')
  async getAdminChat(
    @Param('applicationId') applicationId: string,
    @Param('role') role: string,
    @Param('adminId') adminId: string,
  ) {
    return this.chatService.getAdminChat(applicationId, role, adminId);
  }

  // =====================================================
  // USER APPLICATION LIST
  // =====================================================
  @Get('user/applications/:userId')
  async getUserApplications(@Param('userId') userId: string) {
    return this.chatService.getApplicationsByUserId(userId);
  }
}