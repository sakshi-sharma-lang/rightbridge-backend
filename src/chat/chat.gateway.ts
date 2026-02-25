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
  handleIdentify(socket: WebSocket, data: any) {
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
      // 🔥 FIX: senderRole → senderType
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
    // SEND TO USER
    // =========================================
    const userSocket = this.userSockets.get(
      conversation.userId?.toString()
    );

    if (userSocket && userSocket.readyState === WebSocket.OPEN) {
      userSocket.send(payload);
      delivered++;
    }

    // =========================================
    // SEND ONLY ASSIGNED ADMIN (MULTI TAB SAFE)
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

    const socket = this.userSockets.get(userId);
    if (!socket) return;

    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "notification",
        data: payload
      }));
    }
  }
}