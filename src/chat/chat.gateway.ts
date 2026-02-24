import { Injectable, OnModuleInit } from '@nestjs/common';
import { ChatService } from './chat.service';
import * as WebSocket from 'ws';

@Injectable()
export class ChatGateway implements OnModuleInit {
  constructor(private chatService: ChatService) {}

  private wss: WebSocket.Server;

  private userSockets = new Map<string, WebSocket>();
  private adminSockets = new Map<string, Set<WebSocket>>();
  private appRooms = new Map<string, Set<WebSocket>>();

  onModuleInit() {
    setTimeout(() => {
      const server = (global as any).serverInstance;

      if (!server) {
        console.log("WS FAILED: serverInstance not found");
        return;
      }

      this.wss = new WebSocket.Server({
        server,
        path: "/ws",
      });

      console.log("WEBSOCKET STARTED SUCCESSFULLY");

      this.wss.on('connection', (socket: WebSocket) => {
        console.log('CLIENT CONNECTED');
        console.log("Total WS clients:", this.wss.clients.size);

        socket.on('message', async (data: any) => {
          try {
            const msg = JSON.parse(data.toString());
            await this.routeMessage(socket, msg);
          } catch (err) {
            console.log("WS ERROR:", err);
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

  // =====================================================
  // IDENTIFY USER / ADMIN
  // =====================================================
  handleIdentify(socket: WebSocket, data: any) {

    if (data.role === 'user') {
      this.userSockets.set(data.userId, socket);
      console.log('User online:', data.userId);

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

      if (data.applicationId) {
        const room = this.appRooms.get(data.applicationId) ?? new Set<WebSocket>();
        room.add(socket);
        this.appRooms.set(data.applicationId, room);
      }
    }
  }

  // =====================================================
  // TYPING EVENT (UNCHANGED)
  // =====================================================
  handleTyping(data: any) {
    const roomSockets = this.appRooms.get(data.applicationId);
    if (!roomSockets) return;

    roomSockets.forEach(sock => {
      if (sock.readyState === WebSocket.OPEN) {
        sock.send(JSON.stringify({
          type: "typing",
          userId: data.userId
        }));
      }
    });
  }

  // =====================================================
  // SEND MESSAGE REALTIME (FIXED ONLY HERE)
  // =====================================================
  async handleSendMessage(data: any) {
    let saved;

    if (data.senderRole === 'admin')
      saved = await this.chatService.sendMessageByAdmin(data);
    else
      saved = await this.chatService.sendMessageByUser(data);

    // ================= USER → ADMIN =================
    if (data.senderRole === 'user') {

      const adminId = saved.adminId?.toString();
      const adminSet = this.adminSockets.get(adminId);

      if (adminSet) {
        adminSet.forEach(sock => {
          if (sock.readyState === WebSocket.OPEN) {
            sock.send(JSON.stringify({
              type: "receiveMessage",
              data: saved.messageData || saved,
              meta: saved
            }));
          }
        });
      }
    }


// ================= ADMIN → USER =================
if (data.senderRole === 'admin') {

  const targetUserId = saved.userId?.toString() || data.userId;

  if (!targetUserId) return;

  const userSocket = this.userSockets.get(targetUserId);

  if (userSocket && userSocket.readyState === WebSocket.OPEN) {
    userSocket.send(JSON.stringify({
      type: "receiveMessage",
      data: saved.messageData || saved,
      meta: saved
    }));
  }
}

    // 🔔 SEND NOTIFICATION ALSO (UNCHANGED)
    if (data.receiverUserId) {
      this.sendNotificationToUser(data.receiverUserId, {
        title: "New Message",
        message: saved?.messageData?.message || saved?.message,
        applicationId: data.applicationId
      });
    }
  }

  // =====================================================
  // DISCONNECT CLEANUP (UNCHANGED)
  // =====================================================
  handleDisconnect(socket: WebSocket) {

    for (const [userId, s] of this.userSockets) {
      if (s === socket) this.userSockets.delete(userId);
    }

    for (const [adminId, set] of this.adminSockets) {
      if (set.has(socket)) {
        set.delete(socket);
        if (set.size === 0) this.adminSockets.delete(adminId);
      }
    }

    for (const [appId, set] of this.appRooms) {
      if (set.has(socket)) {
        set.delete(socket);
        if (set.size === 0) this.appRooms.delete(appId);
      }
    }

    console.log("Client disconnected");
  }

  // =====================================================
  // 🔔 NOTIFICATION FUNCTION (UNCHANGED)
  // =====================================================
  sendNotificationToUser(userId: string, payload: any) {

    console.log("\n🔔 REALTIME NOTIFICATION TRY");
    console.log("UserId:", userId);
    console.log("Total online users:", this.userSockets.size);
    console.log("Online user list:", [...this.userSockets.keys()]);

    const socket = this.userSockets.get(userId);

    if (!socket) {
      console.log("❌ User NOT connected via websocket:", userId);
      return;
    }

    console.log("✅ User socket found");

    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "notification",
        data: payload
      }));

      console.log("🚀 Notification delivered realtime to:", userId);
    } else {
      console.log("❌ Socket exists but not open. State:", socket.readyState);
    }

    console.log("🔔 END NOTIFICATION\n");
  }
}