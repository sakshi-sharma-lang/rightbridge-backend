import { Injectable, NotFoundException  , InternalServerErrorException ,BadRequestException} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model  , Types} from 'mongoose';
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
    console.log("hersss");
  const payload = {
    ...dto,
    applicationIds: dto.applicationIds.map(
      (id) => new Types.ObjectId(id),
    ),
  };

  return this.surveyorModel.create(payload);
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



async findByApplication(applicationId: string) {
  try {
    // 1️⃣ Validate applicationId
    if (!Types.ObjectId.isValid(applicationId)) {
      throw new BadRequestException('Invalid application id');
    }

    // 2️⃣ Find surveyors linked to this application
    const surveyors = await this.surveyorModel.find({
      applicationIds: new Types.ObjectId(applicationId),
      isActive: true,
    });

    // 3️⃣ No surveyor found
    if (!surveyors.length) {
      throw new NotFoundException(
        'No surveyor found for this application',
      );
    }

    // 4️⃣ Success response (NO data key)
    return {
      statusCode: 200,
      message: 'Surveyors fetched successfully',
      surveyors,
    };
  } catch (error) {
    if (error.status) throw error;

    throw new InternalServerErrorException(
      'Failed to fetch surveyors',
    );
  }
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
  const surveyor = await this.surveyorModel.findByIdAndDelete(id);

  if (!surveyor) {
    throw new NotFoundException('Surveyor not found');
  }

  return { message: 'Surveyor deleted successfully' };
}

}

