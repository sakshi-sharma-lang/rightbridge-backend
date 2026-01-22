import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApplicationDocument } from './schemas/application-document.schema';
import { Application } from '../applications/schemas/application.schema';
import * as fs from 'fs';
import { join } from 'path';

@Injectable()
export class ApplicationDocumentsService {
  constructor(
    @InjectModel(ApplicationDocument.name)
    private documentModel: Model<ApplicationDocument>,

    @InjectModel(Application.name)
    private applicationModel: Model<Application>,
  ) {}

  async moveAndSave(
    userId: string,
    applicationId: string,
    type: string,
    file: Express.Multer.File,
  ) {
    // ✅ STEP 1: VALIDATE APPLICATION EXISTS (CRITICAL)
    const applicationExists = await this.applicationModel.exists({
      _id: applicationId,
    });

    if (!applicationExists) {
      throw new BadRequestException(
        'Invalid application ID. Application does not exist.',
      );
    }

    // ✅ STEP 2: Prepare directory
    const targetDir = join(
      process.cwd(),
      'uploads',
      'application-documents',
      applicationId,
    );

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // ✅ STEP 3: Check existing document
    const existingDoc = await this.documentModel.findOne({
      applicationId,
      type,
    });

    // ✅ STEP 4: Delete old file if exists
    if (existingDoc?.filePath) {
      const oldDiskPath = join(process.cwd(), existingDoc.filePath);
      if (fs.existsSync(oldDiskPath)) {
        fs.unlinkSync(oldDiskPath);
      }
    }

    // ✅ STEP 5: Move new file
    const targetPath = join(targetDir, file.filename);
    fs.renameSync(file.path, targetPath);

    // ✅ STEP 6: Save / Replace DB record
    const document = await this.documentModel.findOneAndUpdate(
      { applicationId, type },
      {
        userId,
        applicationId,
        type,
        filePath: `/uploads/application-documents/${applicationId}/${file.filename}`,
        originalName: file.originalname,
        size: file.size,
      },
      { upsert: true, new: true },
    );

    return {
      message: existingDoc
        ? 'Document replaced successfully'
        : 'Document uploaded successfully',
      document,
    };
  }
}
