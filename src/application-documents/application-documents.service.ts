import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ApplicationDocument } from './schemas/application-document.schema';
import { Application } from '../applications/schemas/application.schema';
import { DocumentItem } from './schemas/application-document.schema';
import { DOCUMENT_TYPE_MAP, REQUIRED_DOCUMENTS } from './document-types';
import { S3Helper } from '../common/s3.helper';

@Injectable()
export class ApplicationDocumentsService {
  constructor(
    @InjectModel(ApplicationDocument.name)
    private documentModel: Model<ApplicationDocument>,

    @InjectModel(Application.name)
    private applicationModel: Model<Application>,
  ) {}

  // ================= USER UPLOAD =================
  async moveAndSave(
    userId: string,
    applicationId: string,
    type: string,
    file: Express.Multer.File,
    uploadedBy?: string,
  ) {
    try {
      // 🔴 validations
      if (!userId) throw new BadRequestException('userId is required');
      if (!applicationId) throw new BadRequestException('applicationId is required');
      if (!Types.ObjectId.isValid(applicationId))
        throw new BadRequestException('Invalid applicationId format');

      if (!type) throw new BadRequestException('Document type is required');
      if (!file) throw new BadRequestException('File is required');

      if (!file.buffer || file.size === 0)
        throw new BadRequestException('Uploaded file is empty');

      if (!REQUIRED_DOCUMENTS.includes(type as any)) {
        throw new BadRequestException(
          `Invalid document type. Allowed types: ${REQUIRED_DOCUMENTS.join(', ')}`,
        );
      }

      const application = await this.applicationModel.findById(applicationId);
      if (!application) throw new BadRequestException('Application not found');

      // 🔴 upload to S3
      const now = new Date();

const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');

const key = `${year}/${month}/${day}/${applicationId}/${type}/${Date.now()}-${file.originalname}`;

      const s3Url = await S3Helper.upload(file, key);

      const newDoc: DocumentItem = {
        type,
        filePath: s3Url,
        originalName: file.originalname,
        size: file.size,
        uploadedBy: uploadedBy ?? 'user',
        createdAt: new Date(),
      };

      let record = await this.documentModel.findOne({ applicationId, userId });

      if (!record) {
        record = await this.documentModel.create({
          applicationId,
          userId,
          documents: [newDoc],
        });

        return { message: 'Document uploaded successfully', record };
      }

      const index = record.documents.findIndex(d => d.type === type);

      if (index !== -1) {
        // delete old from S3
        try {
          await S3Helper.delete(record.documents[index].filePath);
        } catch (e) {
          console.error('Old S3 delete failed:', e);
        }
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
      if (error instanceof BadRequestException) throw error;

      console.error('UPLOAD DOCUMENT ERROR:', error);
      throw new InternalServerErrorException('Document upload failed');
    }
  }

  // ================= USER GET =================
  async getByApplication(applicationId: string, userId: string) {
    try {
      if (!userId) throw new BadRequestException('userId is required');
      if (!applicationId)
        throw new BadRequestException('applicationId is required');

      if (!Types.ObjectId.isValid(applicationId))
        throw new BadRequestException('Invalid applicationId format');

      const application = await this.applicationModel.findOne({
        _id: applicationId,
        userId,
      });

      if (!application)
        throw new BadRequestException('Application not found or access denied');

      const record = await this.documentModel.findOne({
        applicationId,
        userId,
      });

      const uploadedDocs = record?.documents || [];

      const uploadedMap = new Map(uploadedDocs.map(doc => [doc.type, doc]));

      const documents = Object.keys(DOCUMENT_TYPE_MAP).map(type => {
        const doc = uploadedMap.get(type);

        return {
          type,
          label: this.humanizeType(type),
          uploaded: !!doc,
          uid: doc?.uid || null,
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
      if (error instanceof BadRequestException) throw error;

      console.error('GET DOCUMENT ERROR:', error);
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  private humanizeType(type: string): string {
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // ================= ADMIN GET =================
  async getDocumentsForAdmin(applicationId: string) {
    try {
      if (!applicationId)
        throw new BadRequestException('applicationId is required');

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
          internal_document:
            record.adminDocumentUpload?.internal_document || [],
        },
        documents: record.documents || [],
      };
    } catch (error) {
      console.error('GET DOCUMENTS FOR ADMIN ERROR:', error);
      throw new InternalServerErrorException('Failed to fetch documents');
    }
  }

  // ================= ADMIN RENAME =================
  async adminRenameDocument(body: {
    applicationId: string;
    type: string;
    uid: string;
    newName: string;
  }) {
    try {
      const { applicationId, type, uid, newName } = body;

      if (!applicationId || !type || !uid || !newName)
        throw new BadRequestException(
          'applicationId, type, uid and newName are required',
        );

      const record = await this.documentModel.findOne({ applicationId });
      if (!record) throw new BadRequestException('Record not found');

      let updatedFrom = '';
      let updatedDoc: any = null;

      if (type === 'credit_report' || type === 'internal_document') {
        updatedDoc = record.adminDocumentUpload?.[type]?.find(
          d => d.uid === uid,
        );
        if (updatedDoc) {
          updatedDoc.originalName = newName;
          updatedFrom = type;
        }
      }

      if (!updatedFrom) {
        updatedDoc = record.documents?.find(
          d => d.uid === uid && d.type === type,
        );
        if (updatedDoc) {
          updatedDoc.originalName = newName;
          updatedFrom = 'documents';
        }
      }

      if (!updatedFrom) throw new BadRequestException('Document not found');

      await record.save();

      return {
        message: `Document renamed successfully in ${updatedFrom}`,
        uid,
        newName,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;

      console.error('RENAME DOCUMENT ERROR:', error);
      throw new InternalServerErrorException('Failed to rename document');
    }
  }

  // ================= ADMIN DELETE =================
  async adminDeleteDocument(body: {
    applicationId: string;
    type: string;
    uid: string;
  }) {
    try {
      const { applicationId, type, uid } = body;

      if (!applicationId || !type || !uid)
        throw new BadRequestException(
          'applicationId, type and uid are required',
        );

      const record = await this.documentModel.findOne({ applicationId });
      if (!record) throw new BadRequestException('Record not found');

      let deletedFrom = '';
      let filePath = '';

      if (type === 'credit_report' || type === 'internal_document') {
        const index = record.adminDocumentUpload?.[type]?.findIndex(
          d => d.uid === uid,
        );

        if (index > -1) {
          filePath = record.adminDocumentUpload[type][index].filePath;
          record.adminDocumentUpload[type].splice(index, 1);
          deletedFrom = type;
        }
      }

      if (!deletedFrom) {
        const index = record.documents?.findIndex(
          d => d.uid === uid && d.type === type,
        );

        if (index > -1) {
          filePath = record.documents[index].filePath;
          record.documents.splice(index, 1);
          deletedFrom = 'documents';
        }
      }

      if (!deletedFrom) throw new BadRequestException('Document not found');

      try {
        await S3Helper.delete(filePath);
      } catch (e) {
        console.error('S3 delete failed:', e);
      }

      await record.save();

      return {
        message: `Document deleted successfully from ${deletedFrom}`,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;

      console.error('DELETE DOCUMENT ERROR:', error);
      throw new InternalServerErrorException('Failed to delete document');
    }
  }

  // ================= ADMIN UPLOAD =================
  async uploadAdminDocument(
  applicationId: string,
  userId: string,
  type: string,
  file: Express.Multer.File,
) {
  try {
    if (!applicationId || !userId)
      throw new BadRequestException('applicationId & userId required');

    if (!file) throw new BadRequestException('File is required');

    const allowedTypes = ['credit_report', 'internal_document'];
    if (!allowedTypes.includes(type)) {
      throw new BadRequestException(
        'Admin can upload only credit_report or internal_document',
      );
    }

    // 🔵 date folder structure
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    // 🔵 final S3 key format
    const key = `admindocument/${year}/${month}/${day}/${applicationId}/${type}/${Date.now()}-${file.originalname}`;

    // 🔵 upload to S3
    const s3Url = await S3Helper.upload(file, key);

    const newDoc: DocumentItem = {
      type,
      filePath: s3Url,
      originalName: file.originalname,
      size: file.size,
      uploadedBy: 'admin',
      createdAt: new Date(),
    };

    // 🔵 save in DB
    await this.documentModel.findOneAndUpdate(
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
  } catch (error) {
    if (error instanceof BadRequestException) throw error;

    console.error('ADMIN UPLOAD ERROR:', error);
    throw new InternalServerErrorException('Admin upload failed');
  }
}

}
