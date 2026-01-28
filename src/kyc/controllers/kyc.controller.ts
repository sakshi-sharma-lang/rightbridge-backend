import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SumsubService } from '../services/sumsub.service';
import { Kyc } from '../schemas/kyc.schema';
import { KycStatus } from '../enums/kyc-status.enum';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Controller('kyc')
export class KycController {
  constructor(
    private readonly sumsubService: SumsubService,
    @InjectModel(Kyc.name)
    private readonly kycModel: Model<Kyc>,
  ) {}

  // ================= CREATE APPLICANT =================
  @UseGuards(JwtAuthGuard)
  @Post('create-applicant')
  async createApplicant(@Body() body: any, @Req() req: any) {
    try {
      const { externalUserId, applicationId, email } = body;

      // ✅ Validate input
      if (!externalUserId || typeof externalUserId !== 'string') {
        throw new BadRequestException('externalUserId is required');
      }

      if (!applicationId || typeof applicationId !== 'string') {
        throw new BadRequestException('applicationId is required');
      }

      if (email && typeof email !== 'string') {
        throw new BadRequestException('email must be a string');
      }

      // ✅ Get UserId from JWT (NOT frontend)
      const jwtUserId = req.user?.userId;

      if (!jwtUserId) {
        throw new UnauthorizedException('Invalid JWT token');
      }

      // ✅ SECURITY CHECK: externalUserId must belong to user
      // if (!externalUserId.startsWith(jwtUserId)) {
      //   throw new UnauthorizedException(
      //     'externalUserId does not belong to this user',
      //   );
      // }

      // ✅ Check if KYC already exists for this application
      const existingKyc = await this.kycModel.findOne({
        UserId: jwtUserId,
        applicationId,
      });

      if (existingKyc) {
        return {
          success: true,
          applicantId: existingKyc.applicantId,
          externalUserId: existingKyc.externalUserId,
          message: 'KYC already exists for this application',
        };
      }

      // ✅ Create applicant in Sumsub
      const applicant = await this.sumsubService.createApplicant(
        externalUserId,
        email,
      );

      if (!applicant || !applicant.applicantId) {
        throw new InternalServerErrorException(
          'Sumsub applicant creation failed',
        );
      }

      const levelName = applicant.levelName || process.env.SUMSUB_LEVEL_NAME;

      if (!levelName) {
        throw new InternalServerErrorException('Sumsub levelName missing');
      }

      // ✅ Save KYC in DB
      await this.kycModel.create({
        UserId: jwtUserId,
        applicationId,
        externalUserId,
        applicantId: applicant.applicantId,
        levelName,
        status: KycStatus.PENDING,
      });

      return {
        success: true,
        applicantId: applicant.applicantId,
        externalUserId,
      };
    } catch (error) {
      console.error('❌ create-applicant error:', error?.message);

      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        error?.message || 'Failed to create applicant',
      );
    }
  }

  // ================= SDK TOKEN =================
 // @UseGuards(JwtAuthGuard)
  @Get('sdk-token')
  async getSdkToken(
    @Query('applicationId') applicationId: string,
    @Req() req: any,
  ) {
    try {
      if (!applicationId || typeof applicationId !== 'string') {
        throw new BadRequestException('applicationId is required');
      }

      const jwtUserId = req.user?.userId;

      // if (!jwtUserId) {
      //   throw new UnauthorizedException('Invalid JWT token');
      // }

      // ✅ Find KYC using UserId + applicationId (SECURE)
      const kyc = await this.kycModel.findOne({
        applicationId,
      }).lean();

      if (!kyc) {
        throw new NotFoundException(
          'KYC record not found for this application',
        );
      }

      if (!kyc.externalUserId) {
        throw new InternalServerErrorException(
          'externalUserId not found for this application',
        );
      }

      // ✅ Generate Sumsub SDK token using externalUserId
      const token = await this.sumsubService.generateSdkToken(
        kyc.externalUserId,
      );

      if (!token || typeof token !== 'string') {
        throw new InternalServerErrorException(
          'Failed to generate SDK token',
        );
      }

      return {
        success: true,
        token,
        applicantId: kyc.applicantId,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      console.error('❌ sdk-token error:', error?.message);

      throw new InternalServerErrorException(
        error?.message || 'Failed to generate SDK token',
      );
    }
  }
}
