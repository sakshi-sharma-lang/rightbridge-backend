import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './schemas/user.schema';
import { MailModule } from '../mail/mail.module';
import { ChatModule } from '../chat/chat.module';
import { NotificationModule } from '../notification/notification.module'; // ⭐ IMPORTANT
import { Admin, AdminSchema } from '../admin/schemas/admin.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Admin.name, schema: AdminSchema }, // needed for super admin find
    ]),
    MailModule,
    forwardRef(() => ChatModule),
    forwardRef(() => NotificationModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}