import { Injectable, OnModuleInit } from '@nestjs/common';
import { ChatService } from './chat.service';
import * as WebSocket from 'ws';
import { INestApplication } from '@nestjs/common';

@Injectable()
export class ChatGateway implements OnModuleInit {
  constructor(private chatService: ChatService) {}

  private wss: WebSocket.Server;

  private userSockets = new Map<string, WebSocket>();
  private adminSockets = new Map<string, Set<WebSocket>>();

  // ⭐ NEW: application based rooms
  private appRooms = new Map<string, Set<WebSocket>>();

  onModuleInit() {

    setTimeout(() => {
      const server = (global as any).serverInstance;

      if (!server) {
        console.log(" WS FAILED: serverInstance not found");
        return;
      }

      this.wss = new WebSocket.Server({ 
        server,
        path: "/ws"
      });

      console.log("🚀 WEBSOCKET STARTED SUCCESSFULLY");

      this.wss.on('connection', (socket: WebSocket) => {
        console.log(' CLIENT CONNECTED');

        socket.on('message', async (data: any) => {
          try {
            const msg = JSON.parse(data.toString());
            await this.routeMessage(socket, msg);
          } catch (err) {
            console.log(" REAL ERROR:", err);
          }
        });

        socket.on('close', () => this.handleDisconnect(socket));
      });

    }, 2000);
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

      // ⭐ join application room
      if (data.applicationId) {
        const room = this.appRooms.get(data.applicationId) ?? new Set<WebSocket>();
        room.add(socket);
        this.appRooms.set(data.applicationId, room);
      }
    }

    if (data.role === 'admin') {

      const adminSet = this.adminSockets.get(data.adminId) ?? new Set<WebSocket>();
      adminSet.add(socket);
      this.adminSockets.set(data.adminId, adminSet);

      console.log('Admin online:', data.adminId);

      // ⭐ join application room
      if (data.applicationId) {
        const room = this.appRooms.get(data.applicationId) ?? new Set<WebSocket>();
        room.add(socket);
        this.appRooms.set(data.applicationId, room);
      }
    }
  }

  handleTyping(data: any) {
    const roomSockets = this.appRooms.get(data.applicationId);

    if (roomSockets) {
      roomSockets.forEach(sock => {
        sock.send(JSON.stringify({
          type: "typing",
          userId: data.userId
        }));
      });
    }
  }

  async handleSendMessage(data: any) {
    let saved;

    if (data.senderRole === 'admin')
      saved = await this.chatService.sendMessageByAdmin(data);
    else
      saved = await this.chatService.sendMessageByUser(data);

    // ⭐ send only to same application room
    const roomSockets = this.appRooms.get(data.applicationId);

    if (roomSockets) {
      roomSockets.forEach(sock => {
        sock.send(JSON.stringify({
          type: "receiveMessage",
          data: saved
        }));
      });
    }
  }

  handleDisconnect(socket: WebSocket) {
    for (const [userId, s] of this.userSockets) {
      if (s === socket) this.userSockets.delete(userId);
    }

    for (const [adminId, set] of this.adminSockets) {
      if (set.has(socket)) set.delete(socket);
    }


    for (const [appId, set] of this.appRooms) {
      if (set.has(socket)) set.delete(socket);
    }
  }
}
