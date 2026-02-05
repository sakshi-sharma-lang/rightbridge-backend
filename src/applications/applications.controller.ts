import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
  UnauthorizedException,
  Query,
  UseInterceptors,
  BadRequestException,
  UploadedFiles,
  Delete,  
  Put,

} from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';

import { FilesInterceptor } from '@nestjs/platform-express';
import { AnyFilesInterceptor } from '@nestjs/platform-express';

import * as multer from 'multer';
import * as fs from 'fs';
import * as path from 'path'
import { diskStorage } from 'multer';
import { extname } from 'path';
@UseGuards(JwtAuthGuard)
@Controller('')
export class ApplicationsController {
  constructor(private readonly service: ApplicationsService) {}
//    @Post('applications')
//   create(@Req() req: any, @Body() body: any) {


//   const userId = req.user?.userId;
//   if (!userId) {
//     throw new UnauthorizedException('Invalid or missing token');
//   }

//   return this.service.create(body, userId);
// }


@Post('applications')
@UseInterceptors(
  FilesInterceptor('documents', 10, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB
    },
    fileFilter: (req, file, cb) => {
      const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
      const ext = extname(file.originalname).toLowerCase();

      if (!allowed.includes(ext)) {
        return cb(
          new BadRequestException(
            'Only PDF, JPG, and PNG files are allowed',
          ),
          false,
        );
      }

      cb(null, true);
    },
    storage: diskStorage({
      destination: './tmp', // temp folder
      filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + extname(file.originalname));
      },
    }),
  }),
)
create(
  @Req() req,
  @Body() body,
  @UploadedFiles() files: Express.Multer.File[],
) {
  const userId = req.user?.userId;
  if (!userId) throw new UnauthorizedException();
  return this.service.create(body, userId, files);
}

  @Get('applications/:id')
  get(@Req() req: any, @Param('id') id: string) {

    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Invalid or missing token');
    }
    return this.service.findById(id, userId);
  }

   @Get('applications/admin/:id') 
  @UseGuards(AdminJwtGuard)
  getUserApplicationForAdmin(@Param('id') id: string) {
    return this.service.findUserApplicationByIdForAdmin(id);
  }

  // @Patch('applications/:id')
  // update(@Req() req: any, @Param('id') id: string, @Body() body: any) {

  //   const userId = req.user?.userId;
  //   if (!userId) {
  //     throw new UnauthorizedException('Invalid or missing token');
  //   }
  //   return this.service.update(id, body, userId);
  // }


  // Update appliaction details frontend api application tabs
@Patch('applications/:id')
@UseInterceptors(AnyFilesInterceptor())
updateApplicationDetails(
  @Req() req: any,
  @Param('id') id: string,
  @Body() body: any,
) {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedException('Invalid or missing token');
  }
  return this.service.updateApplicationDetails(id, body, userId);
}

 
 @Get('applications/admin/dashboard/overview')
@UseGuards(AdminJwtGuard)
getApplicationsAdmindashboard(@Query() query: any) {

  return this.service.getApplicationsAdmindashboard(query);
}

@Get('applications/:id/summary')
@UseGuards(JwtAuthGuard)
getApplicationSummary(@Param('id') id: string) {
  return this.service.getApplicationSummary(id);
}

// Application Details Section api frotnend user 2nd tabs

@Get('applications/:applicationId/details')
getApplicationDetails(
  @Req() req: any,
  @Param('applicationId') applicationId: string,
) {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedException('Invalid or missing token');
  }
  return this.service.findById(applicationId, userId);
}


@UseGuards(JwtAuthGuard)
@Delete('applications/delete-documents/:id')
deleteAdditionalDocument(
  @Req() req,
  @Param('id') id: string,
  @Body('fileUrl') fileUrl: string,
) {
  const userId = req.user.userId;
  return this.service.deleteAdditionalDocument(id, userId, fileUrl);
}

@UseGuards(AdminJwtGuard)
@Put('admin/update-priority/:id')
async updatePriority(
  @Param('id') applicationId: string,
  @Body() body: { priority: string },
) {
  return this.service.updatePriority(applicationId, body.priority); 
}


}
