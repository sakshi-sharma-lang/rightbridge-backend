import {
  WebSocketGateway,
  SubscribeMessage,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(private chatService: ChatService) {}

  @WebSocketServer()
  server: Server;

  private userSockets = new Map<string, string>();
  private adminSockets = new Map<string, string>();

  handleConnection(socket: Socket) {
    console.log('Socket connected:', socket.id);
  }

  handleDisconnect(socket: Socket) {
    this.userSockets.forEach((sId, userId) => {
      if (sId === socket.id) this.userSockets.delete(userId);
    });

    this.adminSockets.forEach((sId, adminId) => {
      if (sId === socket.id) this.adminSockets.delete(adminId);
    });
  }

  @SubscribeMessage('registerUser')
  registerUser(@MessageBody() data: any, @ConnectedSocket() socket: Socket) {
    this.userSockets.set(data.userId, socket.id);
  }

  @SubscribeMessage('registerAdmin')
  registerAdmin(@MessageBody() data: any, @ConnectedSocket() socket: Socket) {
    this.adminSockets.set(data.adminId, socket.id);
  }

  @SubscribeMessage('sendMessage')
  async sendMessage(@MessageBody() data: any) {
    const saved = await this.chatService.saveMessage(data);

    const userSocket = this.userSockets.get(data.userId);
    if (userSocket) this.server.to(userSocket).emit('receiveMessage', saved);

    const adminSocket = this.adminSockets.get(data.adminId);
    if (adminSocket) this.server.to(adminSocket).emit('receiveMessage', saved);

    return saved;
  }
}
