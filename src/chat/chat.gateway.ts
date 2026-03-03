import { Injectable, OnModuleInit } from '@nestjs/common';
import { ChatService } from './chat.service';
import * as WebSocket from 'ws';

@Injectable()
export class ChatGateway implements OnModuleInit {
  constructor(private chatService: ChatService) {}

  private wss: WebSocket.Server;

  // =====================================================
  // CHAT SOCKET MAPS (UNCHANGED)
  // =====================================================
  private userSockets = new Map<string, WebSocket>();
  private adminSockets = new Map<string, Set<WebSocket>>();

  // =====================================================
  // OTHER NOTIFICATION SOCKET MAPS (NEW - SEPARATE)
  // =====================================================
  private otherNotificationUserSockets = new Map<string, WebSocket>();
  private otherNotificationAdminSockets = new Map<string, Set<WebSocket>>();

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

            // ===============================
            // CHAT ROUTER (UNCHANGED)
            // ===============================
            await this.routeMessage(socket, msg);

            // ===============================
            // OTHER NOTIFICATION IDENTIFY (NEW)
            // ===============================
            this.handleOtherNotificationIdentify(socket, msg);

          } catch (err) {
            console.log("WS PARSE ERROR:", err);
          }
        });

        socket.on('close', () => {
          this.handleDisconnect(socket); // chat cleanup
          this.handleOtherNotificationDisconnect(socket); // new cleanup
        });
      });

    }, 1200);
  }

  // =====================================================
  // CHAT ROUTER (UNCHANGED)
  // =====================================================
  async routeMessage(socket: WebSocket, data: any) {
    if (data.type === 'identify')
      this.handleIdentify(socket, data);

    if (data.type === 'sendMessage')
      await this.handleSendMessage(data);
  }

  // =====================================================
  // CHAT IDENTIFY (UNCHANGED)
  // =====================================================
  async handleIdentify(socket: WebSocket, data: any) {

    if (data.role === 'user') {
      const userId = String(data.userId);
      this.userSockets.set(userId, socket);
      console.log("👤 User online:", userId);
    }

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
  // CHAT SEND MESSAGE (UNCHANGED)
  // =====================================================
  async handleSendMessage(data: any) {

    let savedMessage;

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

    const conversationId = savedMessage?.conversationId;
    const messageData = savedMessage?.messageData;

    if (!conversationId) return;

    const payload = JSON.stringify({
      type: "receiveMessage",
      conversationId: conversationId,
      data: messageData
    });

    // Send to user
    const userSocket = this.userSockets.get(String(data.userId));
    if (userSocket?.readyState === WebSocket.OPEN)
      userSocket.send(payload);

    // Send to admin (multi-tab safe)
    const adminSet = this.adminSockets.get(String(data.adminId));
    adminSet?.forEach(sock => {
      if (sock.readyState === WebSocket.OPEN)
        sock.send(payload);
    });
  }

  // =====================================================
  // CHAT DISCONNECT CLEANUP (UNCHANGED)
  // =====================================================
  handleDisconnect(socket: WebSocket) {

    for (const [userId, s] of this.userSockets) {
      if (s === socket) {
        this.userSockets.delete(userId);
      }
    }

    for (const [adminId, set] of this.adminSockets) {
      if (set.has(socket)) {
        set.delete(socket);
        if (set.size === 0)
          this.adminSockets.delete(adminId);
      }
    }
  }

  // =====================================================
  // IDENTIFY FOR OTHER NOTIFICATIONS (NEW)
  // =====================================================
  handleOtherNotificationIdentify(socket: WebSocket, data: any) {

    if (data.type !== 'identify_other_notification') return;

    if (data.role === 'user') {
      const userId = String(data.userId);
      this.otherNotificationUserSockets.set(userId, socket);
      console.log("🔔 Other Notification User online:", userId);
    }

    if (data.role === 'admin') {
      const adminId = String(data.adminId);

      const adminSet =
        this.otherNotificationAdminSockets.get(adminId) ??
        new Set<WebSocket>();

      adminSet.add(socket);
      this.otherNotificationAdminSockets.set(adminId, adminSet);

      console.log("🔔 Other Notification Admin online:", adminId);
    }
  }

  // =====================================================
  // SEND OTHER NOTIFICATION → USER (NEW)
  // =====================================================
  sendOtherNotificationToUser(userId: string, payload: any) {

    const socket =
      this.otherNotificationUserSockets.get(String(userId));

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.log("❌ No active OTHER notification socket for user");
      return;
    }

    socket.send(
      JSON.stringify({
        type: 'other_notification',
        data: payload,
      }),
    );

    console.log("🔔 OTHER notification sent to user:", userId);
  }

  // =====================================================
  // SEND OTHER NOTIFICATION → ADMIN (NEW)
  // =====================================================
  sendOtherNotificationToAdmin(adminId: string, payload: any) {

    const adminSet =
      this.otherNotificationAdminSockets.get(String(adminId));

    if (!adminSet || adminSet.size === 0) {
      console.log("❌ No active OTHER notification sockets for admin");
      return;
    }

    adminSet.forEach(socket => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: 'other_notification',
            data: payload,
          }),
        );
      }
    });

    console.log("🔔 OTHER notification delivered to admin:", adminId);
  }

  // =====================================================
  // CLEANUP OTHER NOTIFICATION SOCKETS (NEW)
  // =====================================================
  handleOtherNotificationDisconnect(socket: WebSocket) {

    for (const [userId, s] of this.otherNotificationUserSockets) {
      if (s === socket) {
        this.otherNotificationUserSockets.delete(userId);
      }
    }

    for (const [adminId, set] of this.otherNotificationAdminSockets) {
      if (set.has(socket)) {
        set.delete(socket);
        if (set.size === 0)
          this.otherNotificationAdminSockets.delete(adminId);
      }
    }
  }

}