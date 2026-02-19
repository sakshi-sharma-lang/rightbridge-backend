import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller()
export class ChatController {
  constructor(private chatService: ChatService) {}

  // =====================================================
  // USER SEND
  // =====================================================
  @Post('user/chat/send')
  async sendUserMessage(@Body() body: any) {
    return this.chatService.sendMessageByUser(body);
  }

  // =====================================================
  // ADMIN SEND
  // =====================================================
  @Post('admin/chat/send')
  async sendAdminMessage(@Body() body: any) {
    return this.chatService.sendMessageByAdmin(body);
  }

  // =====================================================
  // ADMIN TOTAL UNREAD
  // =====================================================
  @Get('admin/chat-total-unread')
  async adminTotalUnread() {
    return this.chatService.getAdminTotalUnread();
  }

  // =====================================================
  // USER TOTAL UNREAD
  // =====================================================
  @Get('user/chat-total-unread/:userId')
  async userTotalUnread(@Param('userId') userId: string) {
    return this.chatService.getUserTotalUnread(userId);
  }

  // ADMIN SIDEBAR
  // =====================================================
  @Get('admin/chat')
  async getAdminConversations() {
    return this.chatService.getAdminConversations();
  }

  // =====================================================
  // USER SIDEBAR
  // =====================================================
 // =====================================================
@Get('user/chat/sidebar/:applicationId')
async getUserConversations(
  @Param('applicationId') id: string,
) {
  return this.chatService.getUserConversations(id);
}

  // =====================================================
  // USER OPEN CHAT (OLD - keep)
  // =====================================================
  @Get('user/chat/:userId/:applicationId')
  async getUserChat(
    @Param('userId') userId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.chatService.getUserChat(userId, applicationId);
  }

  // =====================================================
  //  USER OPEN CHAT BY APPLICATION ID (NEW)
  // =====================================================
  @Get('user/chat/application/:applicationId')
  async getUserChatByApplication(
    @Param('applicationId') applicationId: string,
  ) {
    return this.chatService.getUserChatByApplication(applicationId);
  }

  // ADMIN OPEN CHAT BY APPLICATION ID
  // =====================================================
  @Get('admin/chat/application/:applicationId')
  async getAdminChat(
    @Param('applicationId') applicationId: string,
  ) {
    return this.chatService.getAdminChat(applicationId);
  }

@Get('user/applications/:userId')
async getUserApplications(@Param('userId') userId: string) {
  return this.chatService.getApplicationsByUserId(userId);
}

}
