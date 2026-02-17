import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import WebSocket, { WebSocketServer } from 'ws';
import { ChatService } from './chat.service';

@Injectable()
export class ChatGateway implements OnApplicationBootstrap {
  constructor(private chatService: ChatService) {}

  private wss: WebSocketServer;

  private userSockets = new Map<string, WebSocket>();
  private adminSockets = new Map<string, Set<WebSocket>>();

  onApplicationBootstrap() {

    const httpServer = (global as any).httpServer;

    if (!httpServer) {
      console.log("❌ HTTP server not found for WS");
      return;
    }

    this.wss = new WebSocketServer({ server: httpServer });

    console.log("🚀 WebSocket attached to same server");

    this.wss.on('connection', (socket: WebSocket) => {
      console.log('🟢 Client connected');

      socket.on('message', async (data: any) => {
        try {
          const msg = JSON.parse(data.toString());
          await this.routeMessage(socket, msg);
        } catch {
          console.log('Invalid JSON');
        }
      });

      socket.on('close', () => this.handleDisconnect(socket));
    });
  }

  async routeMessage(socket: WebSocket, data: any) {
    if (data.type === 'identify') this.handleIdentify(socket, data);
    if (data.type === 'typing') this.handleTyping(data);
    if (data.type === 'sendMessage') await this.handleSendMessage(data);
  }

  handleIdentify(socket: WebSocket, data: any) {
    if (data.role === 'user') {
      this.userSockets.set(data.userId, socket);
      console.log('User online:', data.userId);
    }

    if (data.role === 'admin') {
      if (!this.adminSockets.has(data.adminId))
        this.adminSockets.set(data.adminId, new Set());

      this.adminSockets.get(data.adminId)?.add(socket);
      console.log('Admin online:', data.adminId);
    }
  }

  handleTyping(data: any) {
    this.adminSockets.forEach(set=>{
      set.forEach(admin=>{
        admin.send(JSON.stringify({ type:"typing", userId:data.userId }));
      });
    });
  }

  async handleSendMessage(data: any) {
    let saved;

    if (data.senderRole === 'admin')
      saved = await this.chatService.sendMessageByAdmin(data);
    else
      saved = await this.chatService.sendMessageByUser(data);

    const userSocket = this.userSockets.get(data.userId);
    if (userSocket) {
      userSocket.send(JSON.stringify({ type:"receiveMessage", data:saved }));
    }

    this.adminSockets.forEach(set=>{
      set.forEach(admin=>{
        admin.send(JSON.stringify({ type:"receiveMessage", data:saved }));
      });
    });
  }

  handleDisconnect(socket: WebSocket) {
    for (const [userId, s] of this.userSockets) {
      if (s === socket) this.userSockets.delete(userId);
    }

    for (const [adminId, set] of this.adminSockets) {
      if (set.has(socket)) set.delete(socket);
    }
  }
}
