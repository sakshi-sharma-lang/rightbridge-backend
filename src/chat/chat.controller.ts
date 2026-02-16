import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  // =====================================================
  // SEND MESSAGE (user/admin)
  // =====================================================
  @Post('send')
  async sendMessage(@Body() body: any) {
    return this.chatService.saveMessage(body);
  }

  // =====================================================
  // ⭐ SINGLE CHAT API (MAIN)
  // userId + applicationId based
  // =====================================================
  @Get('single/:userId/:applicationId/:viewer')
  async getSingleChat(
    @Param('userId') userId: string,
    @Param('applicationId') applicationId: string,
    @Param('viewer') viewer: 'admin' | 'user',
  ) {
    return this.chatService.getChatByUserApplication(
      userId,
      applicationId,
      viewer,
    );
  }

  // =====================================================
  // ADMIN SIDEBAR (all chats)
  // =====================================================
  @Get('admin')
  async getAdminConversations() {
    return this.chatService.getAdminConversations();
  }

  // =====================================================
  // USER SIDEBAR
  // =====================================================
  @Get('user/:userId')
  async getUserConversations(@Param('userId') id: string) {
    return this.chatService.getUserConversations(id);
  }

  // =====================================================
  // ADMIN TOTAL UNREAD
  // =====================================================
  @Get('admin/unread/total')
  async adminTotalUnread() {
    return this.chatService.getAdminTotalUnread();
  }
}
