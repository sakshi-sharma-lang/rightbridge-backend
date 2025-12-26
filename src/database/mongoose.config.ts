import { MongooseModule } from '@nestjs/mongoose';

export const MongooseConfig = MongooseModule.forRoot(
  'mongodb://localhost:27017/rightbridgebackend',
);
