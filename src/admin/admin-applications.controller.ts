import {
  Controller,
  Get,
  Query,
  UseGuards,
  Patch,Req , Param , Body , Post
} from '@nestjs/common';
import { ApplicationsService } from '../applications/applications.service';
import { AdminApplicationsService } from './admin-applications.service';



import { AdminJwtGuard } from '../auth/admin-jwt.guard';

@Controller('')
@UseGuards(AdminJwtGuard)
export class AdminApplicationsController {
  constructor(
    private readonly service: ApplicationsService,
    private readonly adminApplicationsService: AdminApplicationsService,


  ) {}


  // GET /admin/applications
  @Get('admin/all/applications')
  getAllApplicationbyAdmin(@Query() query: any) {
    return this.service.getAllApplicationbyAdmin(query);
  }
@Patch('admin/stage-managment/:id')
updateStageManagment(
  @Param('id') id: string,
  @Body('application_stage_management') stage: string,
  @Body('email') email: string,
) {
  return this.adminApplicationsService.updateStageManagment(
    id,
    stage,
    email,
  );
}


  @Post('admin/decline-dip/:id')
declineDip(
  @Param('id') id: string,
  @Body('reason') reason: string,
   @Body('email') email: string,
     @Body('status') status: string,   // 👈 coming from frontend


) {
  return this.adminApplicationsService.declineDip(id, reason , email , status);
}

}
