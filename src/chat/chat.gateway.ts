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
  console.log("\n==============================");
  console.log("🚀 REALTIME MESSAGE START");
  console.log("Incoming Data:", JSON.stringify(data, null, 2));

  let saved;

  // =====================================
  // SAVE MESSAGE DB
  // =====================================
  try {
    if (data.senderRole === 'admin') {
      console.log("🧑‍💼 Sender is ADMIN");
      saved = await this.chatService.sendMessageByAdmin(data);
    } else {
      console.log("👤 Sender is USER");
      saved = await this.chatService.sendMessageByUser(data);
    }

    console.log("💾 Message saved in DB:", saved?._id || saved?.messageId || "OK");
  } catch (err) {
    console.log("❌ ERROR saving message DB:", err);
  }

  const payload = {
    type: "receiveMessage",
    data: saved?.messageData || saved,
    meta: saved
  };

  console.log("📦 Payload prepared:", JSON.stringify(payload, null, 2));

  // =====================================================
  // 🟢 USER → ADMIN
  // =====================================================
  if (data.senderRole === "user") {
    console.log("\n👤 USER → ADMIN FLOW");

    console.log("Target admin role:", data.receiverAdminRole);
    console.log("All roleSockets keys:", [...this.roleSockets.keys()]);

    if (!data.receiverAdminRole) {
      console.log("❌ receiverAdminRole missing");
    }

    const roleSet = this.roleSockets.get(data.receiverAdminRole);

    if (!roleSet || roleSet.size === 0) {
      console.log("❌ No admin online for role:", data.receiverAdminRole);
    } else {
      console.log("✅ Admin sockets found:", roleSet.size);

      roleSet.forEach(sock => {
        console.log("➡ Sending message to admin socket");
        if (sock.readyState === WebSocket.OPEN) {
          sock.send(JSON.stringify(payload));
        } else {
          console.log("❌ Admin socket not open:", sock.readyState);
        }
      });
    }
  }

  // =====================================================
  // 🟢 ADMIN → USER
  // =====================================================
  if (data.senderRole === "admin") {
    console.log("\n🧑‍💼 ADMIN → USER FLOW");

    console.log("receiverUserId:", data.receiverUserId);
    console.log("All connected users:", [...this.userSockets.keys()]);

    if (!data.receiverUserId) {
      console.log("❌ receiverUserId missing from payload");
    }

    const userSocket = this.userSockets.get(data.receiverUserId);

    if (!userSocket) {
      console.log("❌ USER NOT CONNECTED VIA SOCKET:", data.receiverUserId);
    } else {
      console.log("✅ User socket found");

      if (userSocket.readyState === WebSocket.OPEN) {
        console.log("➡ Sending realtime message to USER");
        userSocket.send(JSON.stringify(payload));
        console.log("🎉 MESSAGE SENT TO USER REALTIME");
      } else {
        console.log("❌ User socket not open. State:", userSocket.readyState);
      }
    }
  }

  // =====================================================
  // 🟢 ECHO BACK TO SAME ADMIN PANEL
  // =====================================================
  if (data.senderRole === "admin" && data.adminId) {
    console.log("\n🧑‍💼 Echo back to same admin panel:", data.adminId);

    const adminSet = this.adminSockets.get(data.adminId);

    if (!adminSet) {
      console.log("❌ Admin socket not found for echo");
    } else {
      console.log("✅ Admin sockets for echo:", adminSet.size);

      adminSet.forEach(sock => {
        if (sock.readyState === WebSocket.OPEN) {
          sock.send(JSON.stringify(payload));
        }
      });
    }
  }

  // =====================================================
  // 🔔 NOTIFICATION
  // =====================================================
  if (data.receiverUserId) {
    console.log("\n🔔 Sending notification to user:", data.receiverUserId);

    this.sendNotificationToUser(data.receiverUserId, {
      title: "New Message",
      message: saved?.messageData?.message || saved?.message,
      applicationId: data.applicationId
    });
  }

  console.log("🏁 REALTIME MESSAGE END");
  console.log("==============================\n");
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