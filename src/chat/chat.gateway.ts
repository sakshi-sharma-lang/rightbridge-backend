import { Injectable, OnModuleInit } from '@nestjs/common';
import { ChatService } from './chat.service';
import * as WebSocket from 'ws';

@Injectable()
export class ChatGateway implements OnModuleInit {
  constructor(private chatService: ChatService) {}

  private wss: WebSocket.Server;

  private userSockets = new Map<string, WebSocket>();

  // adminId -> sockets
  private adminSockets = new Map<string, Set<WebSocket>>();

  // 🔥 ROLE -> sockets (MAIN FIX)
  private roleSockets = new Map<string, Set<WebSocket>>();

  // optional rooms (typing etc)
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
  // IDENTIFY
  // =====================================================
  handleIdentify(socket: WebSocket, data: any) {

    // USER
    if (data.role === 'user') {
      this.userSockets.set(data.userId, socket);
      console.log('User online:', data.userId);
    }

    // ADMIN
    if (data.role === 'admin') {

      // adminId mapping
      const adminSet = this.adminSockets.get(data.adminId) ?? new Set<WebSocket>();
      adminSet.add(socket);
      this.adminSockets.set(data.adminId, adminSet);

      console.log('Admin online:', data.adminId);

      // 🔥 ROLE mapping (IMPORTANT)
      if (data.adminRole) {
        const roleSet = this.roleSockets.get(data.adminRole) ?? new Set<WebSocket>();
        roleSet.add(socket);
        this.roleSockets.set(data.adminRole, roleSet);

        console.log('Admin role:', data.adminRole);
      }
    }

    // optional room
    if (data.applicationId) {
      const room = this.appRooms.get(data.applicationId) ?? new Set<WebSocket>();
      room.add(socket);
      this.appRooms.set(data.applicationId, room);
    }
  }

  // =====================================================
  // TYPING
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
  // SEND MESSAGE ROLE BASED
  // =====================================================
  async handleSendMessage(data: any) {
  let saved;

  // =====================================
  // SAVE MESSAGE DB
  // =====================================
  if (data.senderRole === 'admin')
    saved = await this.chatService.sendMessageByAdmin(data);
  else
    saved = await this.chatService.sendMessageByUser(data);

  const payload = {
    type: "receiveMessage",
    data: saved.messageData || saved,
    meta: saved
  };

  // =====================================================
  // 🟢 CASE 1: USER → ADMIN
  // =====================================================
  if (data.senderRole === "user" && data.receiverAdminRole) {

    const roleSet = this.roleSockets.get(data.receiverAdminRole);

    if (roleSet) {
      roleSet.forEach(sock => {
        if (sock.readyState === WebSocket.OPEN) {
          sock.send(JSON.stringify(payload));
        }
      });

      console.log("📨 Sent USER message to admin role:", data.receiverAdminRole);
    } else {
      console.log("❌ No admin online for role:", data.receiverAdminRole);
    }
  }

  // =====================================================
  // 🟢 CASE 2: ADMIN → USER
  // =====================================================
  if (data.senderRole === "admin" && data.receiverUserId) {

    const userSocket = this.userSockets.get(data.receiverUserId);

    if (userSocket && userSocket.readyState === WebSocket.OPEN) {
      userSocket.send(JSON.stringify(payload));
      console.log("📨 Admin message sent to user:", data.receiverUserId);
    }
  }

  // =====================================================
  // 🟢 ALSO SEND TO SAME ADMIN PANEL (SINGLE ECHO)
  // =====================================================
  if (data.senderRole === "admin" && data.adminId) {
    const adminSet = this.adminSockets.get(data.adminId);

    if (adminSet) {
      adminSet.forEach(sock => {
        if (sock.readyState === WebSocket.OPEN) {
          sock.send(JSON.stringify(payload));
        }
      });
    }
  }

  // =====================================================
  // 🔔 NOTIFICATION TO USER
  // =====================================================
  if (data.receiverUserId) {
    this.sendNotificationToUser(data.receiverUserId, {
      title: "New Message",
      message: saved?.messageData?.message || saved?.message,
      applicationId: data.applicationId
    });
  }
}

  // =====================================================
  // DISCONNECT
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

    for (const [role, set] of this.roleSockets) {
      if (set.has(socket)) {
        set.delete(socket);
        if (set.size === 0) this.roleSockets.delete(role);
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