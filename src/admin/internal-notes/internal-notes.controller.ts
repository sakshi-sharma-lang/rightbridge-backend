import { Controller, Post, Get, Body, Param, Req, UseGuards } from '@nestjs/common';
import { InternalNotesService } from './internal-notes.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('admin-jwt'))
@Controller('admin/internal-notes')
export class InternalNotesController {
  constructor(private readonly notesService: InternalNotesService) {}

  // ✅ ADD NOTE (controller should only call service)
  @Post(':applicationId')
  async addNote(
    @Param('applicationId') applicationId: string,
    @Body() dto: CreateNoteDto,
    @Req() req: any,
  ) {
    const admin = req.user;
    return this.notesService.addNote(applicationId, admin, dto.message);
  }

  // ✅ GET NOTES
  @Get(':applicationId')
  async getNotes(@Param('applicationId') applicationId: string) {
    return this.notesService.getNotes(applicationId);
  }
}
