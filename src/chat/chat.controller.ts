import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller()
export class ChatController {
  constructor(private chatService: ChatService) {}

  // USER SEND
  @Post('user/chat/send')
  async sendUserMessage(@Body() body: any) {
    return this.chatService.sendMessageByUser(body);
  }

  // ADMIN SEND
  @Post('admin/chat/send')
  async sendAdminMessage(@Body() body: any) {
    return this.chatService.sendMessageByAdmin(body);
  }

  // ADMIN TOTAL UNREAD (SAFE ROUTE)
@Get('admin/chat-total-unread')
async adminTotalUnread() {
  return this.chatService.getAdminTotalUnread();
}

//  USER TOTAL UNREAD (SAFE ROUTE)
@Get('user/chat-total-unread/:userId')
async userTotalUnread(@Param('userId') userId: string) {
  return this.chatService.getUserTotalUnread(userId);
}


  // ADMIN SIDEBAR
  @Get('admin/chat')
  async getAdminConversations() {
    return this.chatService.getAdminConversations();
  }

  // USER SIDEBAR
  @Get('user/chat/sidebar/:userId')
  async getUserConversations(@Param('userId') id: string) {
    return this.chatService.getUserConversations(id);
  }

  // USER OPEN CHAT (KEEP BELOW)
  @Get('user/chat/:userId/:applicationId')
  async getUserChat(
    @Param('userId') userId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.chatService.getUserChat(userId, applicationId);
  }

  // ADMIN OPEN CHAT (KEEP LAST)
  @Get('admin/chat/:userId/:applicationId')
  async getAdminChat(
    @Param('userId') userId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.chatService.getAdminChat(userId, applicationId);
  }
}
