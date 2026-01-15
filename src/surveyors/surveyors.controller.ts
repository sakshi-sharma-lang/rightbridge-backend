import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SurveyorsService } from './surveyors.service';
import { CreateSurveyorDto } from './dto/create-surveyor.dto';
import { UpdateSurveyorDto } from './dto/update-surveyor.dto';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';

@Controller('surveyors')
export class SurveyorsController {
  constructor(private readonly service: SurveyorsService) {}

  // ➕ Add Surveyor Option
  @Post()
  @UseGuards(AdminJwtGuard)
  create(@Body() dto: CreateSurveyorDto) {
    return this.service.create(dto);
  }

  // 📄 List / Manage Surveyors
  @Get()
  @UseGuards(AdminJwtGuard)
  findAll(@Query() query: any) {
    return this.service.findAll(query);
  }

  // 🔍 Get Single Surveyor
@Get('by-application/:applicationId')
async findByApplication(
  @Param('applicationId') applicationId: string,
) {
  return this.service.findByApplication(applicationId);
}


  // ✏️ Update Surveyor
  @Patch(':id')
  @UseGuards(AdminJwtGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSurveyorDto,
  ) {
    return this.service.update(id, dto);
  }

  // ❌ Soft Delete Surveyor
  @Delete('delete/:id')
  @UseGuards(AdminJwtGuard)
  remove(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
