export class SendMessageDto {
  conversationId?: string;  
  applicationId: string;    
  userId: string;
  adminId: string;
  senderType: 'admin' | 'user' | 'system';
  message: string;
}