import { Injectable, OnModuleInit } from '@nestjs/common';
import { ChatService } from './chat.service';
import * as WebSocket from 'ws';

@Injectable()
export class ChatGateway implements OnModuleInit {
  constructor(private chatService: ChatService) {}

  private wss: WebSocket.Server;

  // single user → single socket
  private userSockets = new Map<string, WebSocket>();

  // admin multi tabs
  private adminSockets = new Map<string, Set<WebSocket>>();

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

    }, 1200);
  }

  // =====================================================
  // ROUTER
  // =====================================================
  async routeMessage(socket: WebSocket, data: any) {
    if (data.type === 'identify')
      this.handleIdentify(socket, data);

    if (data.type === 'sendMessage')
      await this.handleSendMessage(data);
  }

  // =====================================================
  // IDENTIFY USER / ADMIN
  // =====================================================
  async handleIdentify(socket: WebSocket, data: any) {

    console.log("IDENTIFY:", data);

    // USER CONNECT
    if (data.role === 'user') {
      const userId = String(data.userId);
      this.userSockets.set(userId, socket);
      console.log("👤 User online:", userId);
    }

    // ADMIN CONNECT
    if (data.role === 'admin') {
      const adminId = String(data.adminId);

      const adminSet =
        this.adminSockets.get(adminId) ?? new Set<WebSocket>();

      adminSet.add(socket);
      this.adminSockets.set(adminId, adminSet);

      console.log("🛡 Admin online:", adminId);
    }
  }

  // =====================================================
  // SEND MESSAGE REALTIME
  // =====================================================
  async handleSendMessage(data: any) {

    console.log("\n==============================");
    console.log("📨 NEW MESSAGE Incoming:", data);

    let savedMessage;

    // ==============================
    // SAVE MESSAGE DB
    // ==============================
    try {
      if (data.role === 'admin') {
        savedMessage = await this.chatService.sendMessageByAdmin(data);
      } else {
        savedMessage = await this.chatService.sendMessageByUser(data);
      }
    } catch (err) {
      console.log("❌ DB SAVE ERROR:", err);
      return;
    }

    // ==============================
    // EXTRACT FROM SERVICE RESPONSE
    // ==============================
 const conversationId = savedMessage?.conversationId;
const messageData = savedMessage?.messageData;

if (!conversationId) {
  console.log("❌ conversationId missing after save");
  return;
}

    // ==============================
    // BUILD PAYLOAD (Includes conversationId)
    // ==============================
  const payload = JSON.stringify({
  type: "receiveMessage",
  conversationId: conversationId,
  data: messageData
});

    let delivered = 0;

    // =========================================
    // SEND TO USER
    // =========================================
    const userSocket = this.userSockets.get(String(data.userId));

    if (userSocket && userSocket.readyState === WebSocket.OPEN) {
      userSocket.send(payload);
      delivered++;
    }

    // =========================================
    // SEND TO ASSIGNED ADMIN (MULTI TAB SAFE)
    // =========================================
    const adminSet = this.adminSockets.get(String(data.adminId));

    adminSet?.forEach(sock => {
      if (sock.readyState === WebSocket.OPEN) {
        sock.send(payload);
        delivered++;
      }
    });

    console.log("🚀 Delivered sockets:", delivered);
    console.log("==============================\n");
  }

  // =====================================================
  // DISCONNECT CLEANUP
  // =====================================================
  handleDisconnect(socket: WebSocket) {

    // remove user
    for (const [userId, s] of this.userSockets) {
      if (s === socket) {
        this.userSockets.delete(userId);
        console.log("❌ User offline:", userId);
      }
    }

    // remove admin
    for (const [adminId, set] of this.adminSockets) {
      if (set.has(socket)) {
        set.delete(socket);

        if (set.size === 0)
          this.adminSockets.delete(adminId);

        console.log("❌ Admin offline:", adminId);
      }
    }

    console.log("Client disconnected");
  }

 
 // =====================================================
// REALTIME NOTIFICATION → USER
// =====================================================
// =====================================================
// REALTIME NOTIFICATION → USER (FULL DEBUG)
// =====================================================
sendNotificationToUser(userId: string, payload: any) {

  console.log("\n========== 🔔 USER NOTIFICATION DEBUG ==========");
  console.log("Requested userId:", userId);
  console.log("Active user socket IDs:", Array.from(this.userSockets.keys()));

  const socket = this.userSockets.get(String(userId));

  if (!socket) {
    console.log("❌ No socket found for this userId");
    console.log("Possible reasons:");
    console.log(" - User not connected");
    console.log(" - identify not sent");
    console.log(" - userId mismatch");
    console.log("===============================================\n");
    return;
  }

  console.log("✅ Socket found for user");
  console.log("Socket readyState:", socket.readyState);
  console.log("OPEN state value:", WebSocket.OPEN);

  if (socket.readyState !== WebSocket.OPEN) {
    console.log("❌ Socket exists but NOT OPEN");
    console.log("===============================================\n");
    return;
  }

  try {
    socket.send(
      JSON.stringify({
        type: 'notification',
        data: payload,
      }),
    );

    console.log("🚀 Notification SENT successfully to user:", userId);
  } catch (err) {
    console.log("❌ Error while sending notification:", err);
  }

  console.log("================================================\n");
}
// =====================================================
// REALTIME NOTIFICATION → ADMIN (MULTI TAB SAFE)
// =====================================================
// =====================================================
// REALTIME NOTIFICATION → ADMIN (FULL DEBUG)
// =====================================================
sendNotificationToAdmin(adminId: string, payload: any) {

  console.log("\n========== 🔔 ADMIN NOTIFICATION DEBUG ==========");
  console.log("Requested adminId:", adminId);
  console.log("Active admin IDs:", Array.from(this.adminSockets.keys()));

  const adminSet = this.adminSockets.get(String(adminId));

  if (!adminSet || adminSet.size === 0) {
    console.log("❌ No active sockets found for this admin");
    console.log("Possible reasons:");
    console.log(" - Admin not connected");
    console.log(" - identify not sent");
    console.log(" - adminId mismatch");
    console.log("=================================================\n");
    return;
  }

  console.log("✅ Admin socket set found");
  console.log("Total open tabs:", adminSet.size);

  let delivered = 0;

  adminSet.forEach((socket, index) => {
    console.log(`Checking socket #${index + 1}`);
    console.log("Socket readyState:", socket.readyState);

    if (socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(
          JSON.stringify({
            type: 'notification',
            data: payload,
          }),
        );
        delivered++;
      } catch (err) {
        console.log("❌ Error sending to this socket:", err);
      }
    } else {
      console.log("⚠ Socket not OPEN, skipping");
    }
  });

  console.log("🚀 Delivered to", delivered, "admin sockets");
  console.log("=================================================\n");
}






}