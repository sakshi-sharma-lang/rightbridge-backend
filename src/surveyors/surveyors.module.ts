import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SurveyorsController } from './surveyors.controller';
import { SurveyorsService } from './surveyors.service';
import { Surveyor, SurveyorSchema } from './schemas/surveyor.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Surveyor.name, schema: SurveyorSchema },
    ]),
  ],
  controllers: [SurveyorsController],
  providers: [SurveyorsService],
})
export class SurveyorsModule {}
