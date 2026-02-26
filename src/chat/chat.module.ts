import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './chat.controller';

import { Conversation, ConversationSchema } from './schemas/conversation.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Admin, AdminSchema } from '../admin/schemas/admin.schema';
import { Application, ApplicationSchema } from '../applications/schemas/application.schema';

import { AdminModule } from '../admin/admin.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: User.name, schema: UserSchema },
      { name: Admin.name, schema: AdminSchema },
      { name: Application.name, schema: ApplicationSchema },
    ]),

    forwardRef(() => AdminModule),
    forwardRef(() => NotificationModule), 
  ],
  providers: [ChatService, ChatGateway],
  controllers: [ChatController],
  exports: [ChatGateway, ChatService],
})
export class ChatModule {}