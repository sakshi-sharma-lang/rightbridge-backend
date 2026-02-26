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

// ✅ IMPORT ADMIN SCHEMA (adjust path if needed)
import { Admin, AdminSchema } from '../admin/schemas/admin.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ApplicationDocument.name, schema: ApplicationDocumentSchema },
      { name: Application.name, schema: ApplicationSchema },

      // ⭐ THIS IS REQUIRED
      { name: Admin.name, schema: AdminSchema },
    ]),
    NotificationModule,
  ],
  controllers: [ApplicationDocumentsController],
  providers: [ApplicationDocumentsService],
})
export class ApplicationDocumentsModule {}