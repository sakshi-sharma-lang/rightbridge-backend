import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApplicationsService } from '../applications/applications.service';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';

@Controller('admin/all/applications')
@UseGuards(AdminJwtGuard)
export class AdminApplicationsController {
  constructor(
    private readonly service: ApplicationsService,
  ) {}

  // ✅ SIMPLE ADMIN GET API
  // GET /admin/applications
  @Get()
  getAllApplicationbyAdmin(@Query() query: any) {
    return this.service.getAllApplicationbyAdmin(query);
  }
}
