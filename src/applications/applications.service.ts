import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Application } from './schema/application.schema';
import { CreateApplicationDto } from './dto/create-application.dto';

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectModel(Application.name)
    private applicationModel: Model<Application>,
  ) {}

  async create(dto: CreateApplicationDto) {
    const application = new this.applicationModel(dto);
    return application.save();
  }

  async findAll() {
    return this.applicationModel.find().sort({ createdAt: -1 });
  }
}
