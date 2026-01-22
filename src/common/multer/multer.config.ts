import { diskStorage } from 'multer';
import * as fs from 'fs';
import { join } from 'path';

export const applicationDocMulter = {
  storage: diskStorage({
    destination: (req, file, cb) => {
      const tempDir = join(process.cwd(), 'uploads', 'temp');

      // ✅ Auto-create folder if not exists
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      cb(null, tempDir);
    },

    filename: (req, file, cb) => {
      const uniqueName =
        Date.now() + '-' + Math.round(Math.random() * 1e9) + '-' + file.originalname;
      cb(null, uniqueName);
    },
  }),
};
