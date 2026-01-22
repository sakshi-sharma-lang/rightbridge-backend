import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  Get,
  Param,
  BadRequestException,
  Req,
  Put,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { applicationDocMulter } from '../common/multer/multer.config';
import { ApplicationDocumentsService } from './application-documents.service';
import { REQUIRED_DOCUMENTS } from './document-types';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { AuthGuard } from '@nestjs/passport'; // ✅ ADD THIS

@Controller('application-documents')
export class ApplicationDocumentsController {
  constructor(private readonly service: ApplicationDocumentsService) {}

  // ✅ USER UPLOAD API
  @Post('upload')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('file', applicationDocMulter))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('applicationId') applicationId: string,
    @Body('type') type: string,
    @Req() req,
  ) {
    if (!file) {
      throw new BadRequestException('Document file is required');
    }

    if (!applicationId || !type) {
      throw new BadRequestException(
        'applicationId and type are required',
      );
    }

    if (!REQUIRED_DOCUMENTS.includes(type as any)) {
      throw new BadRequestException(
        `Invalid document type. Allowed types: ${REQUIRED_DOCUMENTS.join(', ')}`,
      );
    }

    const userId = req.user.userId; // ✅ YOUR JWT FORMAT

    if (!userId) {
      throw new BadRequestException('userId not found in JWT token');
    }

    return this.service.moveAndSave(
      userId,
      applicationId,
      type,
      file,
    );
  }


  @Get('admin/document/:applicationId')
  @UseGuards(AdminJwtGuard)
  async getDocumentsForAdmin(
    @Param('applicationId') applicationId: string,
  ) {
    return this.service.getDocumentsForAdmin(applicationId);
  }


@Get(':applicationId')
@UseGuards(AuthGuard('jwt'))
getUserDocuments(
  @Param('applicationId') applicationId: string,
  @Req() req,
) {
  return this.service.getByApplication(
    applicationId,
    req.user.userId,
  );
}


@Put('admin/rename-document')
@UseGuards(AdminJwtGuard)
adminRenameDocument(
  @Body() body: {
    applicationId: string;
    type: string;
    newName: string;
  },
) {
  return this.service.adminRenameDocument(body);
}


@Put('admin/delete-document')
@UseGuards(AdminJwtGuard)
async adminDeleteDocument(
  @Body() body: {
    applicationId: string;
    type: string;
  },
) {
  return this.service.adminDeleteDocument(body);
}



}
