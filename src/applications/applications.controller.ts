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
  Query
} from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';


@UseGuards(JwtAuthGuard)
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  @Post()
  create(@Req() req: any, @Body() body: any) {


  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedException('Invalid or missing token');
  }

  return this.service.create(body, userId);
}

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {

    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Invalid or missing token');
    }
    return this.service.findById(id, userId);
  }

   @Get('admin/:id') 
  @UseGuards(AdminJwtGuard)
  getUserApplicationForAdmin(@Param('id') id: string) {
    return this.service.findUserApplicationByIdForAdmin(id);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {

    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Invalid or missing token');
    }
    return this.service.update(id, body, userId);
  }


  // Update appliaction details frontend api application tabs

  @Patch(':id/update-details')
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


 
 @Get('admin/dashboard/overview')
@UseGuards(AdminJwtGuard)
getApplicationsAdmindashboard(@Query() query: any) {

  return this.service.getApplicationsAdmindashboard(query);
}

@Get(':id/summary')
@UseGuards(JwtAuthGuard)
getApplicationSummary(@Param('id') id: string) {
  return this.service.getApplicationSummary(id);
}

// Application Details Section api frotnend user 2nd tabs

@Get(':applicationId/details')
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

}
