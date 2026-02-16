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
    console.log('Socket disconnected:', socket.id);

    this.userSockets.forEach((sId, userId) => {
      if (sId === socket.id) this.userSockets.delete(userId);
    });

    this.adminSockets.forEach((sId, adminId) => {
      if (sId === socket.id) this.adminSockets.delete(adminId);
    });
  }

  // register user
  @SubscribeMessage('registerUser')
  registerUser(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    this.userSockets.set(data.userId, socket.id);
  }

  // register admin
  @SubscribeMessage('registerAdmin')
  registerAdmin(
    @MessageBody() data: { adminId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    this.adminSockets.set(data.adminId, socket.id);
  }

  // send message realtime
  @SubscribeMessage('sendMessage')
  async sendMessage(
    @MessageBody() data: any,
    @ConnectedSocket() socket: Socket,
  ) {
    const savedMessage = await this.chatService.saveMessage(data);

    const userSocket = this.userSockets.get(data.userId);
    if (userSocket) {
      this.server.to(userSocket).emit('receiveMessage', savedMessage);
    }

    const adminSocket = this.adminSockets.get(data.adminId);
    if (adminSocket) {
      this.server.to(adminSocket).emit('receiveMessage', savedMessage);
    }

    return savedMessage;
  }
}
