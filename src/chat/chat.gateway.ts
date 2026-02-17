import {
  WebSocketGateway,
  SubscribeMessage,
  WebSocketServer,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private chatService: ChatService) {}

  @WebSocketServer()
  server: Server;

  // ================= SOCKET MAP =================
  private userSockets = new Map<string, string>(); // userId -> socketId
  private adminSockets = new Map<string, Set<string>>(); // adminId -> multiple sockets

  // =====================================================
  // CONNECTION
  // =====================================================
  handleConnection(socket: Socket) {
    console.log('Socket connected:', socket.id);
  }

  // =====================================================
  // DISCONNECT (offline detect)
  // =====================================================
  handleDisconnect(socket: Socket) {
    console.log('Socket disconnected:', socket.id);

    // remove user
    for (const [userId, sockId] of this.userSockets) {
      if (sockId === socket.id) {
        this.userSockets.delete(userId);
        this.server.emit('userOffline', { userId });
        console.log('User offline:', userId);
      }
    }

    // remove admin
    for (const [adminId, sockets] of this.adminSockets) {
      if (sockets.has(socket.id)) {
        sockets.delete(socket.id);

        if (sockets.size === 0) {
          this.adminSockets.delete(adminId);
          this.server.emit('adminOffline', { adminId });
        }
      }
    }
  }

  // =====================================================
  // IDENTIFY USER/ADMIN (ONLINE TRACKING)
  // =====================================================
  @SubscribeMessage('identify')
  identify(
    @MessageBody() data: any,
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      if (data.role === 'user' && data.userId) {
        this.userSockets.set(data.userId, socket.id);
        socket.join(`user_${data.userId}`);

        console.log('User online:', data.userId);

        this.server.emit('userOnline', {
          userId: data.userId,
        });
      }

      if (data.role === 'admin' && data.adminId) {
        if (!this.adminSockets.has(data.adminId)) {
          this.adminSockets.set(data.adminId, new Set());
        }

        this.adminSockets.get(data.adminId).add(socket.id);
        socket.join(`admin_${data.adminId}`);

        console.log('Admin online:', data.adminId);

        this.server.emit('adminOnline', {
          adminId: data.adminId,
        });
      }
    } catch (err) {
      console.log('identify error', err.message);
    }
  }

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
  // TYPING INDICATOR
  // =====================================================
  @SubscribeMessage('typing')
  typing(
    @MessageBody() data: any,
    @ConnectedSocket() socket: Socket,
  ) {
    if (!data.userId || !data.applicationId) return;

    const room = `conv_${data.applicationId}_${data.userId}`;

    this.server.to(room).emit('typing', {
      userId: data.userId,
      isTyping: data.isTyping,
    });
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

      // save DB
      if (data.senderRole === 'admin') {
        saved = await this.chatService.sendMessageByAdmin(data);
      } else {
        saved = await this.chatService.sendMessageByUser(data);
      }

      const room = `conv_${data.applicationId}_${data.userId}`;

      // realtime message
      this.server.to(room).emit('receiveMessage', saved);

      // sidebar refresh
      this.server.emit('chatListUpdated');

      return saved;
    } catch (err) {
      console.log('Socket error:', err.message);
    }
  }
}
