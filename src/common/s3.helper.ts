import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

export class S3Helper {

  private static getS3() {
    return new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  static async upload(file: Express.Multer.File, key: string) {
    try {
      const s3 = this.getS3();

      console.log('AWS KEY:', process.env.AWS_ACCESS_KEY_ID);
      console.log('AWS REGION:', process.env.AWS_REGION);

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
