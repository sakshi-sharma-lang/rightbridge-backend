import { Injectable, OnModuleInit } from '@nestjs/common';
import WebSocket, { WebSocketServer } from 'ws';
import { ChatService } from './chat.service';
import * as http from 'http';

@Injectable()
export class ChatGateway implements OnModuleInit {
  constructor(private chatService: ChatService) {}

  private wss: WebSocketServer;

  // user & admin socket maps
  private userSockets = new Map<string, WebSocket>();
  private adminSockets = new Map<string, Set<WebSocket>>();

  // =====================================================
  // START WS SERVER
  // =====================================================
  onModuleInit() {

    const server = http.createServer();

    this.wss = new WebSocketServer({ server });

    server.listen(3093, '0.0.0.0', () => {
      console.log('🚀 PRODUCTION WS RUNNING');
      console.log('WS URL: wss://rightbridgeapi.csdevhub.com:3093');
    });

    this.wss.on('connection', (socket: WebSocket) => {
      console.log('🟢 Client connected');

      socket.on('message', async (data: any) => {
        try {
          const msg = JSON.parse(data.toString());
          await this.routeMessage(socket, msg);
        } catch (err) {
          console.log('❌ Invalid JSON');
        }
      });

      socket.on('close', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  // =====================================================
  // ROUTER
  // =====================================================
  async routeMessage(socket: WebSocket, data: any) {

    if (data.type === 'identify') {
      this.handleIdentify(socket, data);
    }

    if (data.type === 'typing') {
      this.handleTyping(data);
    }

    if (data.type === 'sendMessage') {
      await this.handleSendMessage(data);
    }
  }

  // =====================================================
  // IDENTIFY
  // =====================================================
  handleIdentify(socket: WebSocket, data: any) {

    if (data.role === 'user') {
      this.userSockets.set(data.userId, socket);
      console.log('👤 User online:', data.userId);
    }

    if (data.role === 'admin') {
      if (!this.adminSockets.has(data.adminId)) {
        this.adminSockets.set(data.adminId, new Set());
      }

      this.adminSockets.get(data.adminId)?.add(socket);
      console.log('👑 Admin online:', data.adminId);
    }
  }

  // =====================================================
  // TYPING
  // =====================================================
  handleTyping(data: any) {
    this.adminSockets.forEach((set) => {
      set.forEach((adminSocket) => {
        adminSocket.send(JSON.stringify({
          type: 'typing',
          userId: data.userId
        }));
      });
    });
  }

  // =====================================================
  // SEND MESSAGE
  // =====================================================
  async handleSendMessage(data: any) {

    let saved;

    if (data.senderRole === 'admin') {
      saved = await this.chatService.sendMessageByAdmin(data);
    } else {
      saved = await this.chatService.sendMessageByUser(data);
    }

    // send to user
    const userSocket = this.userSockets.get(data.userId);
    if (userSocket) {
      userSocket.send(JSON.stringify({
        type: 'receiveMessage',
        data: saved
      }));
    }

    // send to all admins
    this.adminSockets.forEach((set) => {
      set.forEach((adminSocket) => {
        adminSocket.send(JSON.stringify({
          type: 'receiveMessage',
          data: saved
        }));
      });
    });
  }

  // =====================================================
  // DISCONNECT
  // =====================================================
  handleDisconnect(socket: WebSocket) {

    for (const [userId, s] of this.userSockets) {
      if (s === socket) {
        this.userSockets.delete(userId);
        console.log('🔴 User offline:', userId);
      }
    }

    for (const [adminId, set] of this.adminSockets) {
      if (set.has(socket)) {
        set.delete(socket);
        console.log('🔴 Admin offline:', adminId);
      }
    }
  }
}
