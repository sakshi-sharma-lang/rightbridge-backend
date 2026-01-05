import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Surveyor, SurveyorDocument } from './schemas/surveyor.schema';
import { CreateSurveyorDto } from './dto/create-surveyor.dto';
import { UpdateSurveyorDto } from './dto/update-surveyor.dto';

@Injectable()
export class SurveyorsService {
  constructor(
    @InjectModel(Surveyor.name)
    private readonly surveyorModel: Model<SurveyorDocument>,
  ) {}

  async create(dto: CreateSurveyorDto) {
    return this.surveyorModel.create(dto);
  }

  async findAll(query: any) {
    const {
      search,
      isActive = true,
      page = 1,
      limit = 10,
    } = query;

    const filter: any = {};

    if (typeof isActive !== 'undefined') {
      filter.isActive = isActive === 'true' || isActive === true;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { accreditation: { $regex: search, $options: 'i' } },
        { companyType: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [data, total] = await Promise.all([
      this.surveyorModel
        .find(filter)
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 }),
      this.surveyorModel.countDocuments(filter),
    ]);

    return {
      total,
      page: Number(page),
      limit: Number(limit),
      data,
    };
  }

  async findOne(id: string) {
    const surveyor = await this.surveyorModel.findById(id);
    if (!surveyor) {
      throw new NotFoundException('Surveyor not found');
    }
    return surveyor;
  }

  async update(id: string, dto: UpdateSurveyorDto) {
    const surveyor = await this.surveyorModel.findByIdAndUpdate(
      id,
      dto,
      { new: true },
    );

    if (!surveyor) {
      throw new NotFoundException('Surveyor not found');
    }

    return surveyor;
  }

  async delete(id: string) {
    const surveyor = await this.surveyorModel.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true },
    );

    if (!surveyor) {
      throw new NotFoundException('Surveyor not found');
    }

    return { message: 'Surveyor deactivated successfully' };
  }
}

