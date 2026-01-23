import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ApplicationDocument } from './schemas/application-document.schema';
import { Application } from '../applications/schemas/application.schema';
import * as fs from 'fs';
import { join } from 'path';
import { DocumentItem } from './schemas/application-document.schema';
import { DOCUMENT_TYPE_MAP, REQUIRED_DOCUMENTS } from './document-types';


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
  uploadedBy?: string,
) {
  try {
    if (!Types.ObjectId.isValid(applicationId)) {
      throw new BadRequestException('Invalid applicationId format');
    }

    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    const application = await this.applicationModel.findById(applicationId);

    if (!application) {
      throw new BadRequestException('Application not found');
    }

    // ✅ ADD: Validate document type (NO OTHER TYPE ALLOWED)
    if (!REQUIRED_DOCUMENTS.includes(type as any)) {
      throw new BadRequestException(
        `Invalid document type. Allowed types: ${REQUIRED_DOCUMENTS.join(', ')}`,
      );
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

    const relativePath = `uploads/application-documents/${applicationId}/${file.filename}`;

    const newDoc: DocumentItem = {
      type, // ✅ only allowed types
      filePath: relativePath,
      originalName: file.originalname,
      size: file.size,
      uploadedBy: uploadedBy ?? 'user',
      createdAt: new Date(),
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
  try {
    if (!applicationId) {
      throw new BadRequestException('applicationId is required');
    }

    const record = await this.documentModel.findOne({ applicationId });

    if (!record) {
      return {
        applicationId,
        adminDocumentUpload: {
          credit_report: [],
          internal_document: [],
        },
        documents: [],
      };
    }

    return {
      applicationId,
      adminDocumentUpload: {
        credit_report: record.adminDocumentUpload?.credit_report || [],
        internal_document: record.adminDocumentUpload?.internal_document || [],
      },
      documents: record.documents || [],
    };
  } catch (error) {
    console.error('GET DOCUMENTS FOR ADMIN ERROR:', error);
    throw new InternalServerErrorException('Failed to fetch documents');
  }
}
async adminRenameDocument(body: {
  applicationId: string;
  type: string;
  newName: string;
}) {
  try {
    const { applicationId, type, newName } = body;

    let result: ApplicationDocument | null = null;
    let updatedDoc: any = null;

    // ✅ 1) USER documents[]
    result = await this.documentModel.findOneAndUpdate(
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

    if (result && result.documents) {
      updatedDoc = result.documents.find(d => d.type === type);

      return {
        message: 'Document renamed successfully (user document)',
        document: updatedDoc,
      };
    }

    // ✅ 2) ADMIN credit_report[]
    result = await this.documentModel.findOneAndUpdate(
      {
        applicationId,
        'adminDocumentUpload.credit_report.type': type,
      },
      {
        $set: {
          'adminDocumentUpload.credit_report.$.originalName': newName,
        },
      },
      { new: true },
    );

    if (result && result.adminDocumentUpload?.credit_report) {
      updatedDoc = result.adminDocumentUpload.credit_report.find(
        d => d.type === type,
      );

      return {
        message: 'Document renamed successfully (credit_report)',
        document: updatedDoc,
      };
    }

    // ✅ 3) ADMIN internal_document[]
    result = await this.documentModel.findOneAndUpdate(
      {
        applicationId,
        'adminDocumentUpload.internal_document.type': type,
      },
      {
        $set: {
          'adminDocumentUpload.internal_document.$.originalName': newName,
        },
      },
      { new: true },
    );

    if (result && result.adminDocumentUpload?.internal_document) {
      updatedDoc = result.adminDocumentUpload.internal_document.find(
        d => d.type === type,
      );

      return {
        message: 'Document renamed successfully (internal_document)',
        document: updatedDoc,
      };
    }

    throw new BadRequestException('Document not found');
  } catch (error) {
    if (error instanceof BadRequestException) throw error;

    console.error('ADMIN RENAME ERROR:', error);
    throw new InternalServerErrorException('Rename failed');
  }
}

async adminDeleteDocument(body: {
  applicationId: string;
  filePath: string;
}) {
  try {
    const { applicationId, filePath } = body;

    if (!applicationId || !filePath) {
      throw new BadRequestException('applicationId and filePath are required');
    }

    const record = await this.documentModel.findOne({ applicationId });

    if (!record) {
      throw new BadRequestException('Record not found');
    }

    let deletedFrom = '';

    // ✅ credit_report
    const creditIndex = record.adminDocumentUpload?.credit_report?.findIndex(
      d => d.filePath === filePath,
    );
    if (creditIndex > -1) {
      record.adminDocumentUpload.credit_report.splice(creditIndex, 1);
      deletedFrom = 'credit_report';
    }

    // ✅ internal_document
    const internalIndex = record.adminDocumentUpload?.internal_document?.findIndex(
      d => d.filePath === filePath,
    );
    if (!deletedFrom && internalIndex > -1) {
      record.adminDocumentUpload.internal_document.splice(internalIndex, 1);
      deletedFrom = 'internal_document';
    }

    // ✅ user documents
    const userIndex = record.documents?.findIndex(
      d => d.filePath === filePath,
    );
    if (!deletedFrom && userIndex > -1) {
      record.documents.splice(userIndex, 1);
      deletedFrom = 'documents';
    }

    if (!deletedFrom) {
      throw new BadRequestException('Document not found');
    }

    const fullPath = join(process.cwd(), filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    await record.save();

    return {
      message: `Document deleted successfully from ${deletedFrom}`,
    };
  } catch (error) {
    console.error('ADMIN DELETE DOCUMENT ERROR:', error);

    if (error instanceof BadRequestException) throw error;

    throw new InternalServerErrorException('Failed to delete document');
  }
}

async uploadAdminDocument(
  applicationId: string,
  userId: string,
  type: string,
  file: Express.Multer.File,
) {
  const allowedTypes = ['credit_report', 'internal_document'];

  if (!allowedTypes.includes(type)) {
    throw new BadRequestException(
      'Admin can upload only credit_report or internal_document',
    );
  }

  const targetDir = join(
    process.cwd(),
    'uploads',
    'application-documents',
    applicationId,
    'admin',
  );

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const targetPath = join(targetDir, file.filename);
  fs.renameSync(file.path, targetPath);

  const relativePath = `uploads/application-documents/${applicationId}/admin/${file.filename}`;

  const newDoc: DocumentItem = {
    type, // credit_report or internal_document
    filePath: relativePath,
    originalName: file.originalname,
    size: file.size,
    uploadedBy: 'admin',
    createdAt: new Date(),
  };

 const result = await this.documentModel.findOneAndUpdate(
  { applicationId, userId },
  {
    $push: {
      [`adminDocumentUpload.${type}`]: newDoc, 
    },
  },
  { upsert: true, new: true },
);


  return {
    message: 'Admin document uploaded successfully',
    data: newDoc,
  };
}






}
