import { Injectable, OnModuleInit } from '@nestjs/common';
import { ChatService } from './chat.service';
import * as WebSocket from 'ws';
import { NotificationService } from '../notification/notification.service';
import { Inject, forwardRef } from '@nestjs/common';

@Injectable()
export class ChatGateway implements OnModuleInit {
 constructor(
  private chatService: ChatService,

  @Inject(forwardRef(() => NotificationService))
  private notificationService: NotificationService,
) {}
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
  async handleIdentify(socket: WebSocket, data: any){
  // handleIdentify(socket: WebSocket, data: any) {
    console.log("IDENTIFY:", data);

    // USER CONNECT
    if (data.role === 'user') {
      const userId = String(data.userId);
      this.userSockets.set(userId, socket);
      console.log("👤 User online:", userId);
    }

    // ADMIN CONNECT
    // ADMIN → USER
if (data.role === 'admin' || data.senderRole === 'super_admin') {
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
    if (data.senderType === 'admin') {
      savedMessage = await this.chatService.sendMessageByAdmin(data);
    } else {
      savedMessage = await this.chatService.sendMessageByUser(data);
    }
  } catch (err) {
    console.log("❌ DB SAVE ERROR:", err);
    return;
  }

  const conversation = savedMessage?.conversation;
  const messageData = savedMessage?.messageData;

  if (!conversation) {
    console.log("❌ conversation missing after save");
    return;
  }

  const payload = JSON.stringify({
    type: "receiveMessage",
    conversationId: conversation._id,
    data: messageData
  });

  let delivered = 0;

  // =========================================
  // SEND MESSAGE TO USER
  // =========================================
  const userSocket = this.userSockets.get(
    conversation.userId?.toString()
  );

  if (userSocket && userSocket.readyState === WebSocket.OPEN) {
    userSocket.send(payload);
    delivered++;
  }

  // =========================================
  // SEND MESSAGE TO ADMIN (MULTI TAB SAFE)
  // =========================================
  const adminSet = this.adminSockets.get(
    conversation.adminId?.toString()
  );

  adminSet?.forEach(sock => {
    if (sock.readyState === WebSocket.OPEN) {
      sock.send(payload);
      delivered++;
    }
  });

  // =====================================================
  // 🔔 ONE TO ONE MESSAGE NOTIFICATION (ALWAYS)
  // =====================================================
  try {

    const text = messageData?.message || "New message";

    // USER → ADMIN
    if (data.senderType === 'user') {
      const adminId = conversation.adminId?.toString();

      if (adminId) {
        await this.notificationService.sendToAdmin({
          adminId: adminId,
          message: `User: ${text}`,
          stage: 'chat',
          type: 'chat',
          applicationId: conversation.applicationId?.toString() || null,
        });
      }
    }

    // ADMIN → USER
    if (data.senderType === 'admin') {
      const userId = conversation.userId?.toString();

      if (userId) {
        await this.notificationService.sendToUser({
          userId: userId,
          message: `Admin: ${text}`,
          stage: 'chat',
          type: 'chat',
          applicationId: conversation.applicationId?.toString() || null,
        });
      }
    }

  } catch (err) {
    console.log("❌ Notification error:", err.message);
  }

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
  // SEND NOTIFICATION TO USER
  // =====================================================
 sendNotificationToUser(userId: string, payload: any) {
  console.log("\n================ WS NOTIFICATION ================");
  console.log("👤 Sending to user:", userId);
  console.log("📦 Payload:", JSON.stringify(payload, null, 2));

  const socket = this.userSockets.get(String(userId));

  if (!socket) {
    console.log("❌ User socket not found (user offline)");
    console.log("================================================\n");
    return;
  }

  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: "notification",
      data: payload
    }));

    console.log("✅ Notification delivered to socket");
  } else {
    console.log("❌ Socket not open");
  }

}
// =====================================================
// SEND NOTIFICATION TO ADMIN (MULTI TAB SAFE)
// =====================================================
sendNotificationToAdmin(adminId: string, payload: any) {
  console.log("\n=========== ADMIN WS NOTIFICATION ===========");
  console.log("🛡 Sending to admin:", adminId);
  console.log("Payload:", payload);

  const adminSet = this.adminSockets.get(String(adminId));

  if (!adminSet || adminSet.size === 0) {
    console.log("❌ Admin offline (no sockets)");
    console.log("============================================\n");
    return;
  }

  adminSet.forEach(socket => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "notification",
        data: payload
      }));
    }
  });

  console.log("✅ Admin notification delivered");
  console.log("============================================\n");
}

}