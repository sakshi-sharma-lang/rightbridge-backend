import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SumsubService } from '../services/sumsub.service';
import { Kyc } from '../schemas/kyc.schema';
import { KycStatus } from '../enums/kyc-status.enum';

@Controller('kyc')
export class KycController {
  constructor(
    private readonly sumsubService: SumsubService,
    @InjectModel(Kyc.name)
    private readonly kycModel: Model<Kyc>,
  ) {}

  @Post('create-applicant')
  async createApplicant(@Body() body: any) {
    const { UserId, email } = body;

    if (!UserId) {
      throw new BadRequestException('UserId is required');
    }

    const applicant = await this.sumsubService.createApplicant(
      UserId,
      email,
    );

    await this.kycModel.create({
      UserId,
      applicantId: applicant.applicantId,
      levelName: applicant.levelName,
      status: KycStatus.PENDING,
    });

    return {
      applicantId: applicant.applicantId,
    };
  }

  @Get('sdk-token')
  async getSdkToken(@Query('UserId') UserId: string) {
    if (!UserId) {
      throw new BadRequestException('UserId is required');
    }

    const kyc = await this.kycModel.findOne({ UserId }).lean();
    if (!kyc) {
      throw new NotFoundException('KYC record not found for this UserId');
    }

    const token = await this.sumsubService.generateSdkToken(UserId);

    if (!token) {
      throw new InternalServerErrorException(
        'Failed to generate SDK token',
      );
    }

    return {
      success: true,
      token,
    };
  }
}
