import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ApplicationDocument } from './schemas/application-document.schema';
import { Application } from '../applications/schemas/application.schema';
import { DOCUMENT_TYPE_MAP } from './document-types';
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

  // ✅ UPLOAD / REPLACE DOCUMENT (applicationId + userId)
  async moveAndSave(
  userId: string,
  applicationId: string,
  type: string,
  file: Express.Multer.File,
) {
  try {
    if (!Types.ObjectId.isValid(applicationId)) {
      throw new BadRequestException('Invalid applicationId format');
    }

    // ✅ DO NOT validate userId as ObjectId (because it's string)
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    const application = await this.applicationModel.findById(applicationId);

    if (!application) {
      throw new BadRequestException('Application not found');
    }

      const targetDir = join(
        process.cwd(),
        'uploads',
        'application-documents',
        applicationId,
      );

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const targetPath = join(targetDir, file.filename);
      fs.renameSync(file.path, targetPath);

     const newDoc = {
  type,
  filePath: `/uploads/application-documents/${applicationId}/${file.filename}`,
  originalName: file.originalname,
  size: file.size,
  createdAt: new Date(), // ✅ ADD THIS
};

      let record = await this.documentModel.findOne({
        applicationId,
        userId,
      });

      if (!record) {
        record = await this.documentModel.create({
          applicationId,
          userId,
          documents: [newDoc],
        });

        return {
          message: 'Document uploaded successfully',
          record,
        };
      }

      const index = record.documents.findIndex(d => d.type === type);

      if (index !== -1) {
        const oldPath = join(process.cwd(), record.documents[index].filePath);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        record.documents[index] = newDoc;
      } else {
        record.documents.push(newDoc);
      }

      await record.save();

      return {
        message:
          index !== -1
            ? 'Document replaced successfully'
            : 'Document uploaded successfully',
        record,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('UPLOAD DOCUMENT ERROR:', error);
      throw new InternalServerErrorException('Document upload failed');
    }
  }

  // ✅ GET DOCUMENTS (ONLY by applicationId)
 async getByApplication(applicationId: string, userId: string) {
  try {
    if (!Types.ObjectId.isValid(applicationId)) {
      throw new BadRequestException('Invalid applicationId format');
    }

    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    // ✅ Check application belongs to user
    const application = await this.applicationModel.findOne({
      _id: applicationId,
      userId,
    });

    if (!application) {
      throw new BadRequestException(
        'Application not found or access denied',
      );
    }

    const record = await this.documentModel.findOne({
      applicationId,
      userId,
    });

    const uploadedDocs = record?.documents || [];

    const uploadedMap = new Map(
      uploadedDocs.map(doc => [doc.type, doc]),
    );

    const documents = Object.keys(DOCUMENT_TYPE_MAP).map(type => {
      const doc = uploadedMap.get(type);

      return {
        type,
        label: this.humanizeType(type),
        uploaded: !!doc,
        fileName: doc?.originalName || null,
        filePath: doc?.filePath || null,
        size: doc?.size || null,
        uploadedAt: doc?.createdAt || null,
      };
    });

    return {
      applicationId,
      totalRequired: documents.length,
      totalUploaded: uploadedDocs.length,
      progressText: `${uploadedDocs.length} of ${documents.length} documents uploaded`,
      documents,
    };
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    console.error('GET DOCUMENT ERROR:', error);
    throw new InternalServerErrorException('Something went wrong');
  }
}


  private humanizeType(type: string): string {
    return type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }


  async getDocumentsForAdmin(applicationId: string) {
  if (!Types.ObjectId.isValid(applicationId)) {
    throw new BadRequestException('Invalid applicationId');
  }

  const application = await this.applicationModel.findById(applicationId);

  if (!application) {
    throw new BadRequestException('Application not found');
  }

  const record = await this.documentModel.findOne({ applicationId });

  const uploadedDocs = record?.documents || [];

  const uploadedMap = new Map(
    uploadedDocs.map(doc => [doc.type, doc]),
  );

  const documents = Object.keys(DOCUMENT_TYPE_MAP).map(type => {
    const doc = uploadedMap.get(type);

    return {
      type,
      label: this.humanizeType(type),
      status: doc ? 'uploaded' : 'pending',
      fileName: doc?.originalName || null,
      filePath: doc?.filePath || null,
      uploadedAt: doc?.createdAt || null,
      size: doc?.size || null,
    };
  });

  return {
    applicationId,
    totalRequired: documents.length,
    totalUploaded: uploadedDocs.length,
    progressText: `${uploadedDocs.length} of ${documents.length} documents uploaded`,
    documents,
  };
}


async adminRenameDocument(body: {
  applicationId: string;
  type: string;
  newName: string;
}) {
  try {
    const { applicationId, type, newName } = body;

    const result = await this.documentModel.findOneAndUpdate(
      {
        applicationId,
        'documents.type': type,
      },
      {
        $set: {
          'documents.$.originalName': newName,
        },
      },
      { new: true },
    );

    if (!result) {
      throw new BadRequestException('Document not found');
    }

    const updatedDoc = result.documents.find(d => d.type === type);

    return {
      message: 'Document renamed successfully',
      document: updatedDoc,
    };
  } catch (error) {
    if (error instanceof BadRequestException) throw error;

    console.error('ADMIN RENAME ERROR:', error);
    throw new InternalServerErrorException('Rename failed');
  }
}



async adminDeleteDocument(body: {
  applicationId: string;
  type: string;
}) {
  try {
    const { applicationId, type } = body;

    if (!applicationId || !type) {
      throw new BadRequestException('applicationId and type are required');
    }

    const record = await this.documentModel.findOne({ applicationId });

    if (!record) {
      throw new BadRequestException('Application document record not found');
    }

    const index = record.documents.findIndex(d => d.type === type);

    if (index === -1) {
      throw new BadRequestException('Document type not found');
    }

    // ✅ Delete file from disk
    const filePath = record.documents[index].filePath;
    const fullPath = join(process.cwd(), filePath);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    // ✅ Remove from array
    record.documents.splice(index, 1);

    await record.save();

    return {
      message: 'Document deleted successfully',
    };
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }

    console.error('ADMIN DELETE DOCUMENT ERROR:', error);
    throw new InternalServerErrorException('Failed to delete document');
  }
}




}
