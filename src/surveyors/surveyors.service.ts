import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Surveyor, SurveyorDocument } from './schemas/surveyor.schema';
import { CreateSurveyorDto } from './dto/create-surveyor.dto';
import { UpdateSurveyorDto } from './dto/update-surveyor.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class SurveyorsService {
  constructor(
  @InjectModel(Surveyor.name)
  private readonly surveyorModel: Model<SurveyorDocument>,

  @InjectModel('Application')
  private readonly applicationModel: Model<any>,

  private readonly mailService: MailService,
) {}

  // ➕ ADD SURVEYOR (max 3 per application)
  async create(dto: CreateSurveyorDto) {
    try {
      const applicationId = new Types.ObjectId(dto.applicationId);

      const surveyorData = {
        name: dto.name,
        companyType: dto.companyType,
        price: dto.price,
        turnaroundTime: dto.turnaroundTime,
        accreditation: dto.accreditation,
        isActive: true,
      };

      let record = await this.surveyorModel.findOne({ applicationId });

      // if document already exists
      if (record) {
        if (record.surveyors.length >= 3) {
          throw new BadRequestException(
            'Maximum 3 surveyors allowed per application',
          );
        }

        record = await this.surveyorModel.findOneAndUpdate(
          { applicationId },
          { $push: { surveyors: surveyorData } },
          { new: true },
        );

        //  TS safety check
        if (!record) {
          throw new InternalServerErrorException(
            'Failed to update surveyor record',
          );
        }

        return {
          success: true,
          message: 'Surveyor added successfully',
          totalSurveyors: record.surveyors.length,
          data: record,
        };
      }

      // first surveyor create document
      record = await this.surveyorModel.create({
        applicationId,
        surveyors: [surveyorData],
      });

      if (!record) {
        throw new InternalServerErrorException('Failed to create surveyor');
      }

      return {
        success: true,
        message: 'Surveyor added successfully',
        totalSurveyors: record.surveyors.length,
        data: record,
      };

    } catch (error) {
      console.log('Create surveyor error:', error);
      if (error instanceof BadRequestException) throw error;

      throw new InternalServerErrorException('Failed to add surveyor');
    }
  }

  //  GET SURVEYORS BY APPLICATION
  async findByApplication(applicationId: string) {
    if (!Types.ObjectId.isValid(applicationId)) {
      throw new BadRequestException('Invalid application id');
    }

    const record = await this.surveyorModel.findOne({
      applicationId: new Types.ObjectId(applicationId),
    });

    if (!record) {
      return {
        success: true,
        message: 'No surveyors added yet',
        data: [],
      };
    }

    return {
      success: true,
      totalSurveyors: record.surveyors.length,
      data: record,
    };
  }

  //  UPDATE SURVEYOR BY surveyorId
  async updateSurveyor(surveyorId: string, dto: UpdateSurveyorDto) {
    const updateFields: any = {};

    if (dto.name !== undefined)
      updateFields['surveyors.$.name'] = dto.name;

    if (dto.companyType !== undefined)
      updateFields['surveyors.$.companyType'] = dto.companyType;

    if (dto.price !== undefined)
      updateFields['surveyors.$.price'] = dto.price;

    if (dto.turnaroundTime !== undefined)
      updateFields['surveyors.$.turnaroundTime'] = dto.turnaroundTime;

    if (dto.accreditation !== undefined)
      updateFields['surveyors.$.accreditation'] = dto.accreditation;

    const updated = await this.surveyorModel.findOneAndUpdate(
      { 'surveyors._id': new Types.ObjectId(surveyorId) },
      { $set: updateFields },
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException('Surveyor not found');
    }

    return {
      success: true,
      message: 'Surveyor updated successfully',
      data: updated,
    };
  }

  //  DELETE SURVEYOR BY surveyorId
  async deleteSurveyor(surveyorId: string) {
    const updated = await this.surveyorModel.findOneAndUpdate(
      { 'surveyors._id': new Types.ObjectId(surveyorId) },
      { $pull: { surveyors: { _id: new Types.ObjectId(surveyorId) } } },
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException('Surveyor not found');
    }

    return {
      success: true,
      message: 'Surveyor removed successfully',
      data: updated,
    };
  }

   async userfindByApplication(applicationId: string) {
    if (!Types.ObjectId.isValid(applicationId)) {
      throw new BadRequestException('Invalid application id');
    }

    const record = await this.surveyorModel.findOne({
      applicationId: new Types.ObjectId(applicationId),
    });

    if (!record) {
      return {
        success: true,
        message: 'No surveyors added yet',
        data: [],
      };
    }

    return {
      success: true,
      totalSurveyors: record.surveyors.length,
      data: record,
    };
  }


async sendQuoteApplicant(applicationId: string) {

  if (!Types.ObjectId.isValid(applicationId)) {
    throw new BadRequestException('Invalid applicationId');
  }

  const application = await this.applicationModel
    .findById(applicationId)
    .select('appId applicants')
    .lean();

  if (!application) {
    throw new NotFoundException('Application not found');
  }

  const applicantEmails =
    application.applicants?.map((a) => a.email) || [];

  if (applicantEmails.length === 0) {
    throw new BadRequestException('No applicant emails found');
  }

  const existingSurveyor = await this.surveyorModel.findOne({
    applicationId: new Types.ObjectId(applicationId),
  });

  if (!existingSurveyor) {
    throw new NotFoundException('Surveyor record not found');
  }

  if (existingSurveyor.SendQuoteApplicant) {
    throw new BadRequestException(
      'Quote already sent to applicants',
    );
  }

  /* Build surveyor table rows */

  const surveyorRows = existingSurveyor.surveyors
    .map(
      (s, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${s.name}</td>
        <td>${s.companyType}</td>
        <td>£${s.price}</td>
        <td>${s.turnaroundTime}</td>
        <td>${s.accreditation}</td>
      </tr>
    `,
    )
    .join('');

  /* Send email */

  await Promise.all(
    applicantEmails.map((email) =>
      this.mailService.sendSurveyorQuoteEmail(
        email,
        application.appId,
        surveyorRows,
      ),
    ),
  );

  existingSurveyor.SendQuoteApplicant = true;
  await existingSurveyor.save();

  return {
    success: true,
    message: 'Quote notification sent to applicants',
    applicationId,
    emailsSent: applicantEmails,
    sendQuoteApplicant: true,
  };
}

}
