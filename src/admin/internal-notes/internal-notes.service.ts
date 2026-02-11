import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InternalNote } from './schemas/internal-note.schema';
import { Admin } from '../schemas/admin.schema';

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

@Injectable()
export class InternalNotesService {
  constructor(
    @InjectModel(InternalNote.name)
    private noteModel: Model<InternalNote>,

    @InjectModel(Admin.name)
    private adminModel: Model<Admin>,
  ) {}

  // =====================================================
  // ADD NOTE (SAVE IN SINGLE ROW)
  // =====================================================
  async addNote(applicationId: string, admin: any, message: string) {
    try {
      console.log('\n========== ADD NOTE DEBUG ==========');
      console.log('JWT ADMIN =>', admin);

      if (!applicationId)
        throw new BadRequestException('ApplicationId required');

      if (!message)
        throw new BadRequestException('Message required');

      if (!admin)
        throw new BadRequestException('Admin not found in request');

      // 🔥 from JWT
      const adminId = admin?.adminId || admin?.id;
      console.log('ADMIN ID FROM TOKEN =>', adminId);

      if (!adminId)
        throw new BadRequestException('Invalid admin token: adminId missing');

      // 🔥 FETCH ADMIN FROM DB
      const adminData = await this.adminModel
        .findById(adminId)
        .select('fullName email');

      console.log('ADMIN DATA FROM DB =>', adminData);

      if (!adminData)
        throw new BadRequestException('Admin not found in DB');

      const appObjectId = new Types.ObjectId(applicationId);
      const adminObjectId = new Types.ObjectId(adminId);

      // 🔥 FIND SAME ROW OR CREATE + PUSH MESSAGE
      const note = await this.noteModel.findOneAndUpdate(
        {
          applicationId: appObjectId,
          adminId: adminObjectId,
        },
        {
          $setOnInsert: {
            applicationId: appObjectId,
            adminId: adminObjectId,
            adminName: adminData.fullName,
            isActive: true,
          },
          $push: {
            messages: {
              message: message,
              createdAt: new Date(),
            },
          },
        },
        {
          new: true,
          upsert: true, // create if not exists
        },
      );

      console.log('✅ NOTE ADDED IN SINGLE ROW');

      return {
        success: true,
        message: 'Note added successfully',
        data: note,
      };

    } catch (error) {
      console.log('❌ ADD NOTE ERROR', error);

      if (error?.name === 'CastError')
        throw new BadRequestException('Invalid applicationId/adminId format');

      if (error?.name === 'ValidationError')
        throw new BadRequestException(error.message);

      throw error;
    }
  }

  // =====================================================
  // GET NOTES
  // =====================================================
  async getNotes(applicationId: string) {
    try {
      if (!applicationId)
        throw new BadRequestException('ApplicationId required');

      const notes = await this.noteModel
        .find({
          applicationId: new Types.ObjectId(applicationId),
          isActive: true,
        })
        .sort({ updatedAt: -1 });

      // 🔥 ADD timeAgo INSIDE EACH MESSAGE
      const formattedNotes = notes.map((note: any) => {
        const obj = note.toObject();

        obj.messages = obj.messages.map((m: any) => ({
          ...m,
          timeAgo: dayjs(m.createdAt).fromNow(),
        }));

        return obj;
      });

      return {
        success: true,
        data: formattedNotes,
      };

    } catch (error) {
      if (error?.name === 'CastError')
        throw new BadRequestException('Invalid applicationId format');

      throw error;
    }
  }
}
