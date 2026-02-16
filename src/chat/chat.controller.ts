import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post('send')
  async sendMessage(@Body() body: any) {
    return this.chatService.saveMessage(body);
  }

  @Get('messages/:conversationId')
  async getMessages(@Param('conversationId') id: string) {
    return this.chatService.getMessages(id);
  }

  @Get('admin')
  async getAdminConversations() {
    return this.chatService.getAdminConversations();
  }

  @Get('user/:userId')
  async getUserConversations(@Param('userId') id: string) {
    return this.chatService.getUserConversations(id);
  }
}
