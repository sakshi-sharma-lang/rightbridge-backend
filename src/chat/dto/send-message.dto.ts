export class SendMessageDto {
  conversationId?: string;
  userId: string;
  adminId: string;
  senderType: 'admin' | 'user' | 'system';
  message: string;
}
