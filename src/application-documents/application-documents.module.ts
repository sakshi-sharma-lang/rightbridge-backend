import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ApplicationDocumentsController } from './application-documents.controller';
import { ApplicationDocumentsService } from './application-documents.service';

import {
  ApplicationDocument,
  ApplicationDocumentSchema,
} from './schemas/application-document.schema';

import {
  Application,
  ApplicationSchema,
} from '../applications/schemas/application.schema';

import { NotificationModule } from '../notification/notification.module';

import { Admin, AdminSchema } from '../admin/schemas/admin.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

import { DocumentReminderCron } from './document-reminder.cron';
import { MailModule } from '../mail/mail.module'; // ⭐ REQUIRED

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ApplicationDocument.name, schema: ApplicationDocumentSchema },
      { name: Application.name, schema: ApplicationSchema },
      { name: Admin.name, schema: AdminSchema },
      { name: User.name, schema: UserSchema },
    ]),

    NotificationModule,
    MailModule, // ⭐ THIS FIXES YOUR ERROR
  ],

  controllers: [ApplicationDocumentsController],

  providers: [
    ApplicationDocumentsService,
    DocumentReminderCron,
  ],
})
export class ApplicationDocumentsModule {}