import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Application } from './schemas/application.schema';
import { Counter } from './schemas/counter.schema';

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectModel(Application.name)
    private readonly applicationModel: Model<Application>,

    @InjectModel(Counter.name)
    private readonly counterModel: Model<Counter>,
  ) {}

  /* ================= CREATE ================= */
  async create(body: any, userId: string): Promise<Application> {
    const appId = await this.generateAppId();

    const application = new this.applicationModel({
      ...body,
      appId,
      userId,
      status: 'active',
      isDraft: true,
    });

    return application.save();
  }

  /* ================= GET ================= */
  async findById(id: string, userId: string): Promise<Application> {
    const app = await this.applicationModel.findOne({ _id: id, userId });

    if (!app) {
      throw new ForbiddenException(
        'You are not authorized to access this application',
      );
    }

    return app;
  }

  /* ================= UPDATE ================= */
  async update(id: string, body: any, userId: string): Promise<Application> {
    const updated = await this.applicationModel.findOneAndUpdate(
      { _id: id, userId },
      {
        $set: {
          ...body,
          isDraft: false,
        },
      },
      { new: true },
    );

    if (!updated) {
      throw new ForbiddenException(
        'You are not authorized to update this application',
      );
    }

    return updated;
  }

  /* ================= APP ID GENERATOR ================= */
  private async generateAppId(): Promise<string> {
    const year = new Date().getFullYear();

    const counter = await this.counterModel.findOneAndUpdate(
      { name: `application-${year}` },
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );

    return `BL-${year}-${counter.seq.toString().padStart(4, '0')}`;
  }
}
