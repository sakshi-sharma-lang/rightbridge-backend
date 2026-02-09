import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { SurveyorsService } from './surveyors.service';
import { CreateSurveyorDto } from './dto/create-surveyor.dto';
import { UpdateSurveyorDto } from './dto/update-surveyor.dto';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
@Controller('surveyors')
@UseGuards(AdminJwtGuard)
export class SurveyorsController {
  constructor(private readonly service: SurveyorsService) {}

  // ➕ ADD surveyor (max 3)
  @Post()
  create(@Body() dto: CreateSurveyorDto) {
    return this.service.create(dto);
  }

  // 📄 GET by application
  @Get('admin/by-application/:applicationId')
    @UseGuards(AdminJwtGuard)
  findByApplication(@Param('applicationId') applicationId: string) {
    return this.service.findByApplication(applicationId);
  }



  // ✏️ UPDATE surveyor (by surveyorId inside array)
  @Patch('admin/:surveyorId')
  @UseGuards(AdminJwtGuard)
  updateSurveyor(
    @Param('surveyorId') surveyorId: string,
    @Body() dto: UpdateSurveyorDto,
  ) {
    return this.service.updateSurveyor(surveyorId, dto);
  }

  // ❌ DELETE surveyor (by surveyorId)
  @Delete('admin/:surveyorId')
  @UseGuards(AdminJwtGuard)
  deleteSurveyor(@Param('surveyorId') surveyorId: string) {
    return this.service.deleteSurveyor(surveyorId);
  }

   // 📄 GET by application
  @Get('/by-application/:applicationId')
    @UseGuards(JwtAuthGuard)
  userfindByApplication(@Param('applicationId') applicationId: string) {
    return this.service.userfindByApplication(applicationId);
  }


}
