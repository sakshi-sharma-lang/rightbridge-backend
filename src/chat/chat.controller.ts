import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller()
export class ChatController {
  constructor(private chatService: ChatService) {}

  // =====================================================
  // 🟢 USER SEND MESSAGE
  // =====================================================
  @Post('user/chat/send')
  async sendUserMessage(@Body() body: any) {
    return this.chatService.sendMessageByUser(body);
  }

  // =====================================================
  // 🔴 ADMIN SEND MESSAGE
  // =====================================================
  @Post('admin/chat/send')
  async sendAdminMessage(@Body() body: any) {
    return this.chatService.sendMessageByAdmin(body);
  }

  // =====================================================
  // 🟢 USER OPEN SINGLE CHAT
  // =====================================================
  @Get('user/chat/:userId/:applicationId')
  async getUserChat(
    @Param('userId') userId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.chatService.getUserChat(userId, applicationId);
  }

  // =====================================================
  // 🔴 ADMIN OPEN SINGLE CHAT
  // =====================================================
  @Get('admin/chat/:userId/:applicationId')
  async getAdminChat(
    @Param('userId') userId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.chatService.getAdminChat(userId, applicationId);
  }

  // =====================================================
  // 🔴 ADMIN SIDEBAR (ALL USERS)
  // =====================================================
  @Get('admin/chat')
  async getAdminConversations() {
    return this.chatService.getAdminConversations();
  }

  // =====================================================
  // 🟢 USER SIDEBAR (ALL APPLICATIONS)
  // =====================================================
  @Get('user/chat/sidebar/:userId')
  async getUserConversations(@Param('userId') id: string) {
    return this.chatService.getUserConversations(id);
  }

  // =====================================================
  // 🔔 ADMIN TOTAL UNREAD
  // =====================================================
  @Get('admin/chat/unread/total')
  async adminTotalUnread() {
    return this.chatService.getAdminTotalUnread();
  }
}
