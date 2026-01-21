import { Controller, Post, Get, Body, Query  ,InternalServerErrorException ,NotFoundException ,BadRequestException} from '@nestjs/common';
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

    const applicant = await this.sumsubService.createApplicant(
      UserId,
      email,
    );

    await this.kycModel.create({
      UserId,
      applicantId: applicant.id,
      status: KycStatus.PENDING,
    });

    return {
      applicantId: applicant.id,
    };
  }

@Get('sdk-token')
async getSdkToken(@Query('UserId') UserId: string) {
  try {
    // ✅ Validation
    if (!UserId || typeof UserId !== 'string') {
      throw new BadRequestException('UserId is required and must be a string');
    }

    // ✅ Fetch KYC record
    const kyc = await this.kycModel.findOne({ UserId }).lean();
    if (!kyc) {
      throw new NotFoundException('KYC record not found for this UserId');
    }

    if (!kyc.applicantId) {
      throw new BadRequestException(
        'ApplicantId is missing for this UserId',
      );
    }

    // ✅ Generate SDK token
    const token = await this.sumsubService.generateSdkToken(
      kyc.applicantId,
    );

    if (!token) {
      throw new InternalServerErrorException(
        'Failed to generate SDK token',
      );
    }

    return {
      success: true,
      token,
    };
  } catch (error) {
    // 🔒 Preserve HTTP exceptions
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException ||
      error instanceof InternalServerErrorException
    ) {
      throw error;
    }

    // 🔥 Fallback for unexpected errors
    throw new InternalServerErrorException(
      error?.message || 'Something went wrong while generating SDK token',
    );
  }
}
}




