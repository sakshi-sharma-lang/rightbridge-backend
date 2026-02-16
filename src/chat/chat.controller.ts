import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller()
export class ChatController {
  constructor(private chatService: ChatService) {}

  // =====================================================
  // 🟢 USER SEND MESSAGE
  // =====================================================
  @Post('chat/send')
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
  // ⭐ USER OLD ROUTE (DO NOT CHANGE)
  // curl http://localhost:3092/chat/single/USER_ID/APPLICATION_ID/user
  // =====================================================
  @Get('chat/single/:userId/:applicationId/:viewer')
  async getSingleChat(
    @Param('userId') userId: string,
    @Param('applicationId') applicationId: string,
    @Param('viewer') viewer: string,
  ) {
    // only user allowed
    if (viewer === 'user') {
      return this.chatService.getUserChat(userId, applicationId);
    }

    return {
      message: 'Only user allowed on this route',
    };
  }

  // =====================================================
  // 🔴 ADMIN OPEN CHAT (separate)
  // =====================================================
  @Get('admin/chat/:userId/:applicationId')
  async getAdminChat(
    @Param('userId') userId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.chatService.getAdminChat(userId, applicationId);
  }

  // =====================================================
  // 🔴 ADMIN SIDEBAR
  // =====================================================
  @Get('admin/chat')
  async getAdminConversations() {
    return this.chatService.getAdminConversations();
  }

  // =====================================================
  // 🟢 USER SIDEBAR
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
