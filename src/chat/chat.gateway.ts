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
  console.log("Incoming Data:", JSON.stringify(data, null, 2));
 
  console.log("🟢 Online Users:", [...this.userSockets.keys()]);
  console.log("🟢 Online Admins:", [...this.adminSockets.keys()]);
  console.log("🟢 Active Rooms:", [...this.appRooms.keys()]);
 
  let savedMessage;
 
  // ================= SAVE IN DB =================
  try {
    console.log("💾 Attempting DB Save...");
 
    if (data.senderRole === 'admin') {
      savedMessage = await this.chatService.sendMessageByAdmin(data);
    } else {
      savedMessage = await this.chatService.sendMessageByUser(data);
    }
 
    console.log("✅ DB SAVE SUCCESS");
    console.log("Saved Wrapper:", JSON.stringify(savedMessage, null, 2));
    console.log("Saved Actual Message:", JSON.stringify(savedMessage?.messageData, null, 2));
 
  } catch (err) {
    console.log("❌ DB SAVE ERROR:", err?.message || err);
    return;
  }
 
  // =====================================================
  // ROOM CHECK
  // =====================================================
  const room = this.appRooms.get(data.applicationId);
 
  if (!room) {
    console.log("❌ ROOM NOT FOUND for applicationId:", data.applicationId);
    return;
  }
 
  console.log("📡 Room Found:", data.applicationId);
  console.log("👥 Total Sockets In Room:", room.size);
 
  // =====================================================
  // PREPARE PAYLOAD
  // =====================================================
  const raw = savedMessage.messageData;
  const messageData =
    raw && typeof (raw as any).toObject === 'function'
      ? (raw as any).toObject()
      : raw
        ? { ...(typeof raw === 'object' && raw !== null ? raw : {}) }
        : {};
  // When user sends to an admin, tell frontend which admin should see this (so other roles don't)
  if (data.senderRole === 'user' && data.adminId) {
    messageData.toAdminId = data.adminId;
  }
  const payload = JSON.stringify({
    type: "receiveMessage",
    data: messageData,
  });
 
  console.log("📦 Outgoing Payload:", payload);
 
  // =====================================================
  // BROADCAST
  // =====================================================
  let deliveredCount = 0;
 
  if (data.senderRole === 'user' && data.adminId) {
    // User sent to a specific admin: only send to that admin's socket(s) and to the user
    const userSocket = this.userSockets.get(data.userId);
    if (userSocket?.readyState === WebSocket.OPEN) {
      userSocket.send(payload);
      deliveredCount++;
    }
    const adminSet = this.adminSockets.get(data.adminId);
    if (adminSet) {
      adminSet.forEach((sock) => {
        if (sock.readyState === WebSocket.OPEN) {
          sock.send(payload);
          deliveredCount++;
        }
      });
    }
  } else {
    // Admin sent to user, or no specific recipient: broadcast to whole room
    room.forEach((sock) => {
      if (sock.readyState === WebSocket.OPEN) {
        sock.send(payload);
        deliveredCount++;
      } else {
        console.log("⚠ Found closed socket in room");
      }
    });
  }
 
  console.log(`🚀 MESSAGE DELIVERED TO ${deliveredCount} SOCKET(S)`);
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
 