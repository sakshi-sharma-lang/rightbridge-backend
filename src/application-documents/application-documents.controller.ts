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



@Post('upload')
@UseGuards(AuthGuard('jwt'))
@UseInterceptors(FileInterceptor('file', applicationDocMulter))
upload(
  @UploadedFile() file: Express.Multer.File,
  @Body() body: any,
  @Req() req,
) {
  console.log('===== BODY DATA =====');
  console.log(body); // ✅ FULL BODY
  console.log('uploadedBy =>', body.uploadedBy); // ✅ SINGLE FIELD
  console.log('applicationId =>', body.applicationId);
  console.log('type =>', body.type);
  console.log('====================');

  const { applicationId, type, uploadedBy } = body;

  if (!file) {
    throw new BadRequestException('Document file is required');
  }

  if (!applicationId || !type) {
    throw new BadRequestException('applicationId and type are required');
  }

  const userId = req.user.userId;

  return this.service.moveAndSave(
    userId,
    applicationId,
    type,
    file,
    uploadedBy,
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


 @Post(':applicationId/upload-document')
@UseGuards(AdminJwtGuard) // ✅ ADD THIS
@UseInterceptors(FileInterceptor('file', applicationDocMulter)) // ✅ ADD MULTER
async uploadAdminDocument(
  @Param('applicationId') applicationId: string,
  @Body('userId') userId: string,
  @Body('type') type: string,
  @UploadedFile() file: Express.Multer.File,
) {
  if (!file) {
    throw new BadRequestException('File is required');
  }

  if (!userId || !type) {
    throw new BadRequestException('userId and type are required');
  }

  return this.service.uploadAdminDocument(applicationId, userId, type, file);
}



}
