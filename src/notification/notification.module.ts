import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Notification, NotificationSchema } from './schemas/notification.schema';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller'; // ✅ ADD THIS
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema }
    ]),
    forwardRef(() => ChatModule),
  ],
  controllers: [NotificationController], // ✅ ADD THIS
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}