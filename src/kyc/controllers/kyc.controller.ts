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
  try {
    const { UserId, email } = body;

    // ✅ validation
    if (!UserId || typeof UserId !== 'string') {
      throw new BadRequestException('UserId is required and must be a string');
    }

    if (email && typeof email !== 'string') {
      throw new BadRequestException('email must be a string');
    }

    // ✅ CASE 1: User already exists in DB
    const existingKyc = await this.kycModel.findOne({ UserId });
    if (existingKyc) {
      return {
        success: true,
        applicantId: existingKyc.applicantId,
        message: 'Applicant already exists in database',
      };
    }

    // ✅ Call Sumsub
    const applicant = await this.sumsubService.createApplicant(UserId, email);

    if (!applicant || !applicant.applicantId) {
      throw new InternalServerErrorException('Sumsub applicant creation failed');
    }

    // ✅ Ensure levelName exists (IMPORTANT)
    const levelName = applicant.levelName || process.env.SUMSUB_LEVEL_NAME;

    if (!levelName) {
      throw new InternalServerErrorException('Sumsub levelName missing');
    }

    // ✅ CASE 2: Applicant exists in Sumsub but not in DB
    if (applicant.alreadyExists) {
      await this.kycModel.create({
        UserId,
        applicantId: applicant.applicantId,
        levelName,
        status: KycStatus.PENDING,
      });

      return {
        success: true,
        applicantId: applicant.applicantId,
        message: 'Applicant already existed in Sumsub but saved in DB',
      };
    }

    // ✅ CASE 3: New applicant created
    await this.kycModel.create({
      UserId,
      applicantId: applicant.applicantId,
      levelName,
      status: KycStatus.PENDING,
    });

    return {
      success: true,
      applicantId: applicant.applicantId,
    };
  } catch (error) {
    console.error('❌ create-applicant error:', error?.message);

    if (error instanceof BadRequestException) {
      throw error;
    }

    throw new InternalServerErrorException(
      error?.message || 'Failed to create applicant',
    );
  }
}


  @Get('sdk-token')
  async getSdkToken(@Query('UserId') UserId: string) {
    try {
      if (!UserId || typeof UserId !== 'string') {
        throw new BadRequestException('UserId is required and must be a string');
      }

      const kyc = await this.kycModel.findOne({ UserId }).lean();
      if (!kyc) {
        throw new NotFoundException('KYC record not found for this UserId');
      }

      if (!kyc.applicantId) {
        throw new InternalServerErrorException(
          'ApplicantId not found for this user',
        );
      }

      // ✅ Correct call
      const token = await this.sumsubService.generateSdkToken(kyc.applicantId);

      if (!token || typeof token !== 'string') {
        throw new InternalServerErrorException(
          'Failed to generate SDK token',
        );
      }

      return {
        success: true,
        token,
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      console.error('❌ sdk-token error:', error?.message);

      throw new InternalServerErrorException(
        error?.message || 'Failed to generate SDK token',
      );
    }
  }
}
