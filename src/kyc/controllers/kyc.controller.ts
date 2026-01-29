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
import { Application } from '../../applications/schemas/application.schema';
import { MailService } from '../../mail/mail.service';

interface KycResult {
  externalUserId: string;
  email: string;
  applicantId: string;
  link: string;
}

@Controller('kyc')
export class KycController {
  constructor(
    private readonly sumsubService: SumsubService,
    private readonly mailService: MailService,
    @InjectModel(Kyc.name)
    private readonly kycModel: Model<Kyc>,
    @InjectModel(Application.name)
    private readonly applicationModel: Model<Application>,
  ) {}

  // ================= START KYC FOR ALL APPLICANTS =================
 @Post('start-kyc')
async startKyc(@Body() body: any) {
  try {
    const { applicationId } = body;

    // ================= VALIDATION =================
    if (!applicationId || typeof applicationId !== 'string') {
      throw new BadRequestException('applicationId is required and must be a string');
    }

    const application = await this.applicationModel.findById(applicationId);

    if (!application) {
      throw new NotFoundException(`Application not found for id: ${applicationId}`);
    }

    if (!Array.isArray(application.applicants) || application.applicants.length === 0) {
      throw new NotFoundException(`No applicants found for applicationId: ${applicationId}`);
    }

    const results: any[] = [];

    // ================= LOOP APPLICANTS =================
    for (const applicant of application.applicants) {
      const { externalUserId, email } = applicant;

      // ---------- Applicant validation ----------
      if (!externalUserId) {
        results.push({
          externalUserId: null,
          email,
          status: 'FAILED',
          error: 'externalUserId missing',
        });
        continue;
      }

      if (!email) {
        results.push({
          externalUserId,
          email: null,
          status: 'FAILED',
          error: 'email missing',
        });
        continue;
      }

      console.log(`\n🔄 Processing applicant: ${externalUserId}`);

      try {
        // ================= FIND KYC =================
        let kyc = await this.kycModel.findOne({ externalUserId });

        // ================= CREATE SUMSUB APPLICANT =================
        if (!kyc || !kyc.applicantId) {
          console.log(`🆕 Creating Sumsub applicant for: ${externalUserId}`);

          const created = await this.sumsubService.createApplicant(externalUserId, email);

          if (!created?.applicantId) {
            throw new Error(`Sumsub applicant creation failed`);
          }

          kyc = await this.kycModel.findOneAndUpdate(
            { externalUserId },
            {
              applicationId,
              externalUserId,
              email,
              applicantId: created.applicantId,
              levelName: created.levelName,
              status: KycStatus.CREATED,
            },
            { upsert: true, new: true },
          );
        }

        // ================= SAFETY CHECK =================
        if (!kyc || !kyc.applicantId) {
          throw new Error(`KYC record not found after creation`);
        }

        // ================= GENERATE SDK TOKEN =================
        console.log(`🔑 Generating SDK token for applicantId: ${kyc.applicantId}`);

        let token: string;
        try {
          token = await this.sumsubService.generateSdkToken(kyc.applicantId);
        } catch (err: any) {
          throw new Error(`SDK token failed: ${err?.message || 'unknown error'}`);
        }

        if (!token) {
          throw new Error(`SDK token is empty`);
        }

        // ================= UPDATE STATUS =================
        if (
          kyc.status === KycStatus.NOT_STARTED ||
          kyc.status === KycStatus.CREATED
        ) {
          await this.kycModel.updateOne(
            { externalUserId },
            { status: KycStatus.LINK_SENT },
          );
        }

        // ================= BUILD KYC LINK =================
        const link = `${process.env.FRONTEND_URL}kyc?applicationId=${applicationId}&userId=${externalUserId}`;


        // ================= SEND EMAIL =================
        try {
          await this.mailService.sendKycEmail(email, link);
          console.log(`📧 KYC email sent to: ${email}`);
        } catch (mailErr: any) {
          console.error(`❌ Email failed for ${email}`, mailErr?.message);
          throw new Error(`Email sending failed`);
        }

        // ================= SUCCESS RESULT =================
        results.push({
          externalUserId,
          email,
          applicantId: kyc.applicantId,
          link,
          status: 'SUCCESS',
        });

      } catch (applicantError: any) {
        console.error(`❌ Applicant failed: ${externalUserId}`, applicantError?.message);

        results.push({
          externalUserId,
          email,
          applicantId: '',
          link: '',
          status: 'FAILED',
          error: applicantError?.message,
        });
      }
    }

    // ================= FINAL RESPONSE =================
    return {
      success: true,
      applicationId,
      totalApplicants: application.applicants.length,
      successCount: results.filter(r => r.status === 'SUCCESS').length,
      failedCount: results.filter(r => r.status === 'FAILED').length,
      results,
    };

  } catch (error: any) {
    console.error('❌ START KYC GLOBAL ERROR:', error);

    throw new InternalServerErrorException(
      error?.message || 'Failed to start KYC process',
    );
  }
}

  // ================= CREATE SINGLE APPLICANT =================
@Post('create-applicant')
async createApplicant(@Body() body: any) {
  try {
    const { externalUserId, applicationId, email } = body;

    if (!externalUserId) throw new BadRequestException('externalUserId required');
    if (!applicationId) throw new BadRequestException('applicationId required');
    if (!email) throw new BadRequestException('email required');

    let kyc = await this.kycModel.findOne({ externalUserId });

    if (kyc?.applicantId) {
      return {
        success: true,
        applicantId: kyc.applicantId,
        externalUserId,
        message: 'Applicant already exists',
      };
    }

    const created = await this.sumsubService.createApplicant(externalUserId, email);

    if (!created?.applicantId) {
      throw new InternalServerErrorException('Sumsub applicant creation failed');
    }

    kyc = await this.kycModel.findOneAndUpdate(
      { externalUserId },
      {
        applicationId,
        externalUserId,
        email,
        applicantId: created.applicantId,
        levelName: created.levelName,
        status: KycStatus.CREATED,
      },
      { upsert: true, new: true },
    );

    // ✅ IMPORTANT FIX (TypeScript safety)
    if (!kyc) {
      throw new InternalServerErrorException('Failed to create or fetch KYC record');
    }

    return {
      success: true,
      applicantId: kyc.applicantId,
      externalUserId,
    };
  } catch (error) {
    console.error('❌ create-applicant error:', error);

    throw new InternalServerErrorException(
      error?.response?.data || error?.message || 'Failed to create applicant',
    );
  }
}

  // ================= GET SDK TOKEN FOR SINGLE APPLICANT =================
  @Get('sdk-token')
  async getSdkToken(
    @Query('applicationId') applicationId: string,
    @Query('externalUserId') externalUserId: string,
  ) {
    try {
      if (!applicationId) throw new BadRequestException('applicationId required');
      if (!externalUserId) throw new BadRequestException('externalUserId required');

      const kyc = await this.kycModel.findOne({ externalUserId });

      if (!kyc) throw new NotFoundException('KYC record not found');

      const token = await this.sumsubService.generateSdkToken(kyc.applicantId);

      if (!token) {
        throw new InternalServerErrorException('SDK token generation failed');
      }

      await this.kycModel.updateOne(
        { externalUserId },
        { status: KycStatus.IN_PROGRESS },
      );

      return {
        success: true,
        token,
        applicantId: kyc.applicantId,
      };
    } catch (error) {
      console.error('❌ sdk-token error:', error);

      throw new InternalServerErrorException(
        error?.message || 'Failed to generate SDK token',
      );
    }
  }
}
