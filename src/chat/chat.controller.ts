import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  // =====================================================
  // SEND MESSAGE
  // =====================================================
  @Post('send')
  async sendMessage(@Body() body: any) {
    return this.chatService.saveMessage(body);
  }

  // =====================================================
  // GET CHAT MESSAGES (WITH SEEN LOGIC)
  // admin or user must pass viewer type
  // =====================================================
  @Get('messages/:conversationId/:viewer')
  async getMessages(
    @Param('conversationId') id: string,
    @Param('viewer') viewer: 'admin' | 'user',
  ) {
    return this.chatService.getMessages(id, viewer);
  }

  // =====================================================
  // ADMIN SIDEBAR ALL CONVERSATIONS
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
  // ⭐ ADMIN OPEN SPECIFIC USER CHAT
  // route: /chat/admin/user/:userId/:applicationId
  // =====================================================
  @Get('admin/user/:userId/:applicationId')
  async adminOpenUserChat(
    @Param('userId') userId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.chatService.getOrCreateConversation(userId, applicationId);
  }

  // =====================================================
  // ⭐ ADMIN TOTAL UNREAD COUNT (TOP BADGE)
  // =====================================================
  @Get('admin/unread/total')
  async adminTotalUnread() {
    return this.chatService.getAdminTotalUnread();
  }
}
