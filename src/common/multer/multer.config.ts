import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';

const tempDir = 'uploads/temp';

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

export const applicationDocMulter = {
  storage: diskStorage({
    destination: tempDir,
    filename: (req, file, cb) => {
      cb(null, Date.now() + extname(file.originalname));
    },
  }),
};
