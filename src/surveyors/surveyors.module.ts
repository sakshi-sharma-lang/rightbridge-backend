import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SurveyorsController } from './surveyors.controller';
import { SurveyorsService } from './surveyors.service';
import { Surveyor, SurveyorSchema } from './schemas/surveyor.schema';

// 🔥 import application schema
import { Application, ApplicationSchema } from '../applications/schemas/application.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Surveyor.name, schema: SurveyorSchema },

      // 🔥 VERY IMPORTANT
      { name: Application.name, schema: ApplicationSchema },
    ]),
  ],
  controllers: [SurveyorsController],
  providers: [SurveyorsService],
})
export class SurveyorsModule {}
