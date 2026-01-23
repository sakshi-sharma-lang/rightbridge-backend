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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ApplicationDocument.name, schema: ApplicationDocumentSchema },
      { name: Application.name, schema: ApplicationSchema }, 
    ]),
  ],
  controllers: [ApplicationDocumentsController],
  providers: [ApplicationDocumentsService],
})
export class ApplicationDocumentsModule {}
