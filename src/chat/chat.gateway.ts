import { Injectable, OnModuleInit } from '@nestjs/common';
import { ChatService } from './chat.service';
import * as WebSocket from 'ws';

@Injectable()
export class ChatGateway implements OnModuleInit {
  constructor(private chatService: ChatService) {}

  private wss: WebSocket.Server;

  // single user → single socket
  private userSockets = new Map<string, WebSocket>();

  // admin can open multiple tabs
  private adminSockets = new Map<string, Set<WebSocket>>();

  // application room → all users + admins
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

    if (data.type === 'identify')
      this.handleIdentify(socket, data);

    if (data.type === 'typing')
      this.handleTyping(data);

    if (data.type === 'sendMessage')
      await this.handleSendMessage(data);
  }

  // =====================================================
  // IDENTIFY USER / ADMIN
  // =====================================================
  handleIdentify(socket: WebSocket, data: any) {
    console.log("IDENTIFY:", data);

    // USER
    if (data.role === 'user') {
      this.userSockets.set(data.userId, socket);
      console.log("👤 User online:", data.userId);

      if (data.applicationId) {
        const room = this.appRooms.get(data.applicationId) ?? new Set<WebSocket>();
        room.add(socket);
        this.appRooms.set(data.applicationId, room);
      }
    }

    // ADMIN
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
  // SEND MESSAGE REALTIME
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

    // SEND REALTIME IN ROOM
    const roomSockets = this.appRooms.get(data.applicationId);

    if (!roomSockets) {
      console.log("❌ No room found for:", data.applicationId);
      return;
    }

    console.log("👥 Room users:", roomSockets.size);

    roomSockets.forEach(sock => {
      if (sock.readyState === WebSocket.OPEN) {
        sock.send(JSON.stringify({
          type: "receiveMessage",
          data: saved.messageData || saved,
          meta: saved
        }));
      }
    });

    // =====================================================
    // 🔔 SEND DIRECT NOTIFICATION
    // =====================================================
    if (data.receiverUserId) {
      this.sendNotificationToUser(data.receiverUserId, {
        title: "New Message",
        message: saved?.messageData?.message || saved?.message,
        applicationId: data.applicationId
      });
    }

    console.log("==============================\n");
  }

  // =====================================================
  // DISCONNECT CLEANUP
  // =====================================================
  handleDisconnect(socket: WebSocket) {

    // user remove
    for (const [userId, s] of this.userSockets) {
      if (s === socket) {
        this.userSockets.delete(userId);
        console.log("❌ User offline:", userId);
      }
    }

    // admin remove
    for (const [adminId, set] of this.adminSockets) {
      if (set.has(socket)) {
        set.delete(socket);
        if (set.size === 0) this.adminSockets.delete(adminId);
        console.log("❌ Admin offline:", adminId);
      }
    }

    // room remove
    for (const [appId, set] of this.appRooms) {
      if (set.has(socket)) {
        set.delete(socket);
        if (set.size === 0) this.appRooms.delete(appId);
      }
    }

    console.log("Client disconnected");
  }

  // =====================================================
  // 🔔 NOTIFICATION
  // =====================================================
  sendNotificationToUser(userId: string, payload: any) {

    console.log("\n🔔 REALTIME NOTIFICATION TRY");
    console.log("User:", userId);
    console.log("Online users:", [...this.userSockets.keys()]);

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

    console.log("🔔 END\n");
  }
}