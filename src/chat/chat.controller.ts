import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  // ================= SEND MESSAGE =================
  // user → admin or admin → user
  @Post('send')
  async sendMessage(@Body() body: any) {
    return this.chatService.saveMessage(body);
  }

  // ================= UNIQUE CHAT =================
  // one admin + one user = single conversation
  @Get('conversation/:userId/:adminId')
  async getUniqueChat(
    @Param('userId') userId: string,
    @Param('adminId') adminId: string,
  ) {
    return this.chatService.getUniqueConversation(userId, adminId);
  }

  // ================= GET MESSAGES =================
  @Get('messages/:conversationId')
  async getMessages(@Param('conversationId') id: string) {
    return this.chatService.getMessages(id);
  }

  // ================= ADMIN SIDEBAR =================
  @Get('admin/:adminId')
  async getAdminConversations(@Param('adminId') id: string) {
    return this.chatService.getAdminConversations(id);
  }

  // ================= USER SIDEBAR =================
  @Get('user/:userId')
  async getUserConversations(@Param('userId') id: string) {
    return this.chatService.getUserConversations(id);
  }
}
