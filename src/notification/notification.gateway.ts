import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect {

  @WebSocketServer()
  server: Server;

  // =====================================================
  // WHEN CLIENT CONNECTS
  // =====================================================
  handleConnection(socket: Socket) {
    console.log('🟢 SOCKET CONNECTED:', socket.id);

    const userId = socket.handshake.query.userId as string;

    if (userId) {
      socket.join(userId);
      console.log(`👤 User joined room: ${userId}`);
    } else {
      console.log('⚠️ No userId provided in socket connection');
    }
  }

  // =====================================================
  // WHEN CLIENT DISCONNECTS
  // =====================================================
  handleDisconnect(socket: Socket) {
    console.log('🔴 SOCKET DISCONNECTED:', socket.id);
  }

  // =====================================================
  // EMIT STAGE NOTIFICATION
  // =====================================================
  emitStageNotification(userId: string, payload: any) {

    console.log('\n==============================');
    console.log('🔔 REALTIME NOTIFICATION START');
    console.log('Send To UserID:', userId);
    console.log('Payload:', payload);

    if (!userId) {
      console.log('❌ ERROR: userId missing, cannot emit');
      return;
    }

    try {
      this.server.to(userId).emit('stage-notification', payload);

      console.log('✅ Notification emitted successfully');
      console.log('==============================\n');

    } catch (err) {
      console.log('❌ SOCKET EMIT ERROR:', err.message);
    }
  }
}
