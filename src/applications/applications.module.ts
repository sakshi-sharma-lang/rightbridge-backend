import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { Application, ApplicationSchema } from './schemas/application.schema';
import { Counter, CounterSchema } from './schemas/counter.schema';
import { AuthModule } from '../auth/auth.module'; // ✅ ADD THIS

@Module({
  imports: [
    AuthModule, // ✅ VERY IMPORTANT
    MongooseModule.forFeature([
      { name: Application.name, schema: ApplicationSchema },
      { name: Counter.name, schema: CounterSchema },
    ]),
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
