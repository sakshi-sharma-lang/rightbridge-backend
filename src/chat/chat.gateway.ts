import {
  WebSocketGateway,
  SubscribeMessage,
  WebSocketServer,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway {
  constructor(private chatService: ChatService) {}

  @WebSocketServer()
  server: Server;

  // =====================================================
  // JOIN CONVERSATION ROOM (when chat open)
  // =====================================================
  @SubscribeMessage('joinConversation')
  joinConversation(
    @MessageBody() data: any,
    @ConnectedSocket() socket: Socket,
  ) {
    if (!data.userId || !data.applicationId) return;

    const room = `conv_${data.applicationId}_${data.userId}`;
    socket.join(room);

    console.log('Joined room:', room);
  }

  // =====================================================
  // SEND REALTIME MESSAGE
  // =====================================================
  @SubscribeMessage('sendMessage')
  async sendMessage(
    @MessageBody() data: any,
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      let saved;

      // save in DB
      if (data.senderRole === 'admin') {
        saved = await this.chatService.sendMessageByAdmin(data);
      } else {
        saved = await this.chatService.sendMessageByUser(data);
      }

      const room = `conv_${data.applicationId}_${data.userId}`;

      // realtime emit to same chat
      this.server.to(room).emit('receiveMessage', saved);

      // sidebar refresh realtime
      this.server.emit('chatListUpdated');

      return saved;

    } catch (err) {
      console.log('Socket error:', err.message);
    }
  }
}
