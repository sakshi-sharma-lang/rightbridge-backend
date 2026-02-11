import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { BadRequestException } from '@nestjs/common';

export class S3Helper {
  private static MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  private static getS3() {
    return new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  // ================= UPLOAD =================
  static async upload(file: Express.Multer.File, key: string) {
    try {
      if (!file) {
        throw new BadRequestException('File is required');
      }

      if (!file.buffer || file.size === 0) {
        throw new BadRequestException('Uploaded file is empty');
      }

      // 🔴 FILE SIZE VALIDATION (GLOBAL)
      if (file.size > this.MAX_FILE_SIZE) {
        throw new BadRequestException(
          'File size cannot exceed 10 MB',
        );
      }

      const s3 = this.getS3();

    

      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME!,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );

      return `${process.env.AWS_S3_BASE_URL}/${key}`;
    } catch (err) {
      console.error('S3 UPLOAD ERROR:', err);
      throw err;
    }
  }

  // ================= DELETE =================
  static async delete(fileUrl: string) {
    try {
      if (!fileUrl) return;

      const s3 = this.getS3();
      const key = fileUrl.split('.net/')[1];

      await s3.send(
        new DeleteObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME!,
          Key: key,
        }),
      );
    } catch (e) {
      console.error('S3 delete error', e);
    }
  }
}
