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

  private userSockets = new Map<string, Set<string>>();
  private adminSockets = new Map<string, Set<string>>();

  // =====================================================
  // CONNECT
  // =====================================================
  handleConnection(socket: Socket) {
    console.log('Socket connected:', socket.id);
  }

  // =====================================================
  // DISCONNECT
  // =====================================================
  handleDisconnect(socket: Socket) {

    this.userSockets.forEach((set, userId) => {
      if (set.has(socket.id)) {
        set.delete(socket.id);
        if (set.size === 0) this.userSockets.delete(userId);
      }
    });

    this.adminSockets.forEach((set, adminId) => {
      if (set.has(socket.id)) {
        set.delete(socket.id);
        if (set.size === 0) this.adminSockets.delete(adminId);
      }
    });

    console.log('Socket disconnected:', socket.id);
  }

  // =====================================================
  // REGISTER USER
  // =====================================================
  @SubscribeMessage('registerUser')
  registerUser(@MessageBody() data: any, @ConnectedSocket() socket: Socket) {

    if (!data.userId) return;

    const existing = this.userSockets.get(data.userId) || new Set<string>();
    existing.add(socket.id);
    this.userSockets.set(data.userId, existing);

    console.log('User socket registered:', data.userId);
  }

  // =====================================================
  // REGISTER ADMIN
  // =====================================================
  @SubscribeMessage('registerAdmin')
  registerAdmin(@MessageBody() data: any, @ConnectedSocket() socket: Socket) {

    if (!data.adminId) return;

    const existing = this.adminSockets.get(data.adminId) || new Set<string>();
    existing.add(socket.id);
    this.adminSockets.set(data.adminId, existing);

    console.log('Admin socket registered:', data.adminId);
  }

  // =====================================================
  // SEND MESSAGE REALTIME
  // =====================================================
  @SubscribeMessage('sendMessage')
  async sendMessage(@MessageBody() data: any) {
    try {
      let saved;

      // 🔴 ADMIN MESSAGE
      if (data.senderRole === 'admin') {
        saved = await this.chatService.sendMessageByAdmin(data);
      }
      // 🟢 USER MESSAGE
      else {
        saved = await this.chatService.sendMessageByUser(data);
      }

      // ================================
      // SEND TO USER SOCKETS
      // ================================
      if (data.userId && this.userSockets.has(data.userId)) {
        const sockets = this.userSockets.get(data.userId);
        if (sockets) {
          sockets.forEach(socketId => {
            this.server.to(socketId).emit('receiveMessage', saved);
          });
        }
      }

      // ================================
      // SEND TO ADMIN SOCKETS
      // ================================
      if (data.adminId && this.adminSockets.has(data.adminId)) {
        const sockets = this.adminSockets.get(data.adminId);
        if (sockets) {
          sockets.forEach(socketId => {
            this.server.to(socketId).emit('receiveMessage', saved);
          });
        }
      }

      // ================================
      // REFRESH SIDEBAR REALTIME
      // ================================
      this.server.emit('chatListUpdated');

      return saved;

    } catch (err) {
      console.log('Socket send error:', err.message);
    }
  }
}
