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
} from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  @Post()
  create(@Req() req: any, @Body() body: any) {
  console.log('JWT USER:', req.user); // 👈 ADD THIS

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

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Invalid or missing token');
    }
    return this.service.update(id, body, userId);
  }
}
