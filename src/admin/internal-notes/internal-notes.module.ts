import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InternalNotesService } from './internal-notes.service';
import { InternalNotesController } from './internal-notes.controller';
import { InternalNote, InternalNoteSchema } from './schemas/internal-note.schema';


import { Admin, AdminSchema } from '../schemas/admin.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InternalNote.name, schema: InternalNoteSchema },
      { name: Admin.name, schema: AdminSchema }, 
    ]),
  ],
  controllers: [InternalNotesController],
  providers: [InternalNotesService],
})
export class InternalNotesModule {}
