import * as multer from 'multer';

export const applicationDocMulter = {
  storage: multer.memoryStorage(),   // 🔴 REQUIRED FOR S3

  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  },

  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Only pdf, jpg, png, doc allowed'), false);
    }

    cb(null, true);
  },
};
