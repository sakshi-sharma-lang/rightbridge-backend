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

  // =====================================================
  // START WS SERVER
  // =====================================================
  onModuleInit() {
    setTimeout(() => {
      const server = (global as any).serverInstance;

      if (!server) {
        console.log("❌ WS FAILED: serverInstance not found");
        return;
      }

      this.wss = new WebSocket.Server({
        server,
        path: "/ws",
      });

      console.log("🚀 WEBSOCKET STARTED SUCCESSFULLY");

      this.wss.on('connection', (socket: WebSocket) => {
        console.log('🟢 CLIENT CONNECTED');
        console.log("Total clients:", this.wss.clients.size);

        socket.on('message', async (data: any) => {
          try {
            const msg = JSON.parse(data.toString());
            await this.routeMessage(socket, msg);
          } catch (err) {
            console.log("WS PARSE ERROR:", err);
          }
        });

        socket.on('close', () => this.handleDisconnect(socket));
      });

    }, 1500);
  }

  // =====================================================
  // ROUTER
  // =====================================================
  async routeMessage(socket: WebSocket, data: any) {
    if (data.type === 'identify') this.handleIdentify(socket, data);
    if (data.type === 'typing') this.handleTyping(data);
    if (data.type === 'sendMessage') await this.handleSendMessage(data);
  }

  // =====================================================
  // IDENTIFY USER / ADMIN
  // =====================================================
  handleIdentify(socket: WebSocket, data: any) {
    console.log("IDENTIFY:", data);

    if (data.role === 'user') {
      this.userSockets.set(data.userId, socket);
      console.log("👤 User online:", data.userId);

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

      console.log("🛡 Admin online:", data.adminId);

      if (data.applicationId) {
        const room = this.appRooms.get(data.applicationId) ?? new Set<WebSocket>();
        room.add(socket);
        this.appRooms.set(data.applicationId, room);
      }
    }

    console.log("ROOM SIZE:",
      this.appRooms.get(data.applicationId)?.size || 0
    );
  }

  // =====================================================
  // TYPING EVENT
  // =====================================================
  handleTyping(data: any) {
    const roomSockets = this.appRooms.get(data.applicationId);
    if (!roomSockets) return;

    roomSockets.forEach(sock => {
      if (sock.readyState === WebSocket.OPEN) {
        sock.send(JSON.stringify({
          type: "typing",
          userId: data.userId,
          senderRole: data.senderRole
        }));
      }
    });
  }

  // =====================================================
  // SEND MESSAGE REALTIME (🔥 CHANGED ONLY THIS FUNCTION)
  // =====================================================
  async handleSendMessage(data: any) {
    console.log("\n==============================");
    console.log("📨 NEW MESSAGE EVENT");
    console.log("Payload:", data);

    let saved;

    // SAVE MESSAGE
    if (data.senderRole === 'admin') {
      saved = await this.chatService.sendMessageByAdmin(data);
    } else {
      saved = await this.chatService.sendMessageByUser(data);
    }

    console.log("💾 DB SAVED");

    const payload = JSON.stringify({
      type: "receiveMessage",
      data: saved.messageData || saved,
      meta: saved
    });

    // =====================================================
    // 🟢 USER SENDING MESSAGE
    // =====================================================
    if (data.senderRole === 'user') {

      const assignedAdminId = saved?.conversation?.assignedAdminId;
      const superAdminId = saved?.conversation?.superAdminId;

      let targetAdminId;

      if (assignedAdminId) {
        targetAdminId = assignedAdminId;
        console.log("➡ Send to UNDERWRITER:", targetAdminId);
      } else {
        targetAdminId = superAdminId;
        console.log("➡ Send to SUPERADMIN:", targetAdminId);
      }

      const adminSet = this.adminSockets.get(targetAdminId);

      if (!adminSet) {
        console.log("❌ Target admin not online");
        return;
      }

      adminSet.forEach(sock => {
        if (sock.readyState === WebSocket.OPEN) {
          sock.send(payload);
        }
      });

      return;
    }

    // =====================================================
    // 🟢 ADMIN SENDING MESSAGE → USER ONLY
    // =====================================================
    if (data.senderRole === 'admin') {

      const userId = saved?.conversation?.userId || data.userId;

      console.log("➡ Admin message to user:", userId);

      const userSocket = this.userSockets.get(userId);

      if (userSocket && userSocket.readyState === WebSocket.OPEN) {
        userSocket.send(payload);
      } else {
        console.log("❌ User offline");
      }

      return;
    }
  }

  // =====================================================
  // DISCONNECT CLEANUP
  // =====================================================
  handleDisconnect(socket: WebSocket) {
    for (const [userId, s] of this.userSockets) {
      if (s === socket) {
        this.userSockets.delete(userId);
        console.log("❌ User offline:", userId);
      }
    }

    for (const [adminId, set] of this.adminSockets) {
      if (set.has(socket)) {
        set.delete(socket);
        if (set.size === 0) this.adminSockets.delete(adminId);
        console.log("❌ Admin offline:", adminId);
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
  // NOTIFICATION
  // =====================================================
  sendNotificationToUser(userId: string, payload: any) {

    console.log("\n🔔 REALTIME NOTIFICATION TRY");

    const socket = this.userSockets.get(userId);

    if (!socket) {
      console.log("❌ User not online");
      return;
    }

    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "notification",
        data: payload
      }));

      console.log("🚀 Notification sent to:", userId);
    } else {
      console.log("❌ Socket not open");
    }
  }
}