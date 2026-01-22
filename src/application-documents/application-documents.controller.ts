import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { applicationDocMulter } from '../common/multer/multer.config';
import { ApplicationDocumentsService } from './application-documents.service';
import { REQUIRED_DOCUMENTS } from './document-types';

@Controller('application-documents')
export class ApplicationDocumentsController {
  constructor(private readonly service: ApplicationDocumentsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', applicationDocMulter))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('userId') userId: string,
    @Body('applicationId') applicationId: string,
    @Body('type') type: string,
  ) {
    if (!file) {
      throw new BadRequestException('Document file is required');
    }

    if (!userId || !applicationId || !type) {
      throw new BadRequestException(
        'userId, applicationId and type are required',
      );
    }

    if (!REQUIRED_DOCUMENTS.includes(type as any)) {
      throw new BadRequestException(
        `Invalid document type. Allowed types: ${REQUIRED_DOCUMENTS.join(', ')}`,
      );
    }

    return this.service.moveAndSave(
      userId,
      applicationId,
      type,
      file,
    );
  }
}
