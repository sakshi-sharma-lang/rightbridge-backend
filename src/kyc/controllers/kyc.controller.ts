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
  @Post('create-applicant')
  async createApplicant(@Body() body: any) {
    try {
      const { UserId, externalUserId, email } = body;

      if (!UserId || typeof UserId !== 'string') {
        throw new BadRequestException('UserId is required and must be a string');
      }

      if (!externalUserId || typeof externalUserId !== 'string') {
        throw new BadRequestException(
          'externalUserId is required and must be a string',
        );
      }

      if (email && typeof email !== 'string') {
        throw new BadRequestException('email must be a string');
      }

      const existingKyc = await this.kycModel.findOne({ externalUserId });
      if (existingKyc) {
        return {
          success: true,
          applicantId: existingKyc.applicantId,
          message: 'Applicant already exists in database',
        };
      }

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

      if (applicant.alreadyExists) {
        await this.kycModel.create({
          UserId,
          externalUserId,
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

      await this.kycModel.create({
        UserId,
        externalUserId,
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

  // ================= SDK TOKEN =================
  @UseGuards(JwtAuthGuard)
  @Get('sdk-token')
  async getSdkToken(
    @Query('externalUserId') externalUserId: string,
    @Req() req: any,
  ) {
    try {
      if (!externalUserId || typeof externalUserId !== 'string') {
        throw new BadRequestException(
          'externalUserId is required and must be a string',
        );
      }

      const jwtUserId = req.user?.userId;

      if (!jwtUserId) {
        throw new UnauthorizedException('Invalid JWT token');
      }

      const kyc = await this.kycModel.findOne({ externalUserId }).lean();

      if (!kyc) {
        throw new NotFoundException('KYC record not found for this applicant');
      }

      // if (kyc.UserId !== jwtUserId) {
      //   throw new UnauthorizedException(
      //     'You are not authorized to access this applicant',
      //   );
      // }

      if (!kyc.applicantId) {
        throw new InternalServerErrorException(
          'ApplicantId not found for this user',
        );
      }

      // ✅ CORRECT: use externalUserId (NOT applicantId)
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
