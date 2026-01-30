import {
  Controller,
  Post,
  Body,
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

 @Post('start-kyc')
async startKyc(@Body() body: any) {
  try {
    const { applicationId } = body;

    console.log('🚀 START KYC REQUEST:', body);

    if (!applicationId || typeof applicationId !== 'string') {
      throw new BadRequestException('applicationId is required and must be a string');
    }

    const application = await this.applicationModel.findById(applicationId);

    console.log('📦 APPLICATION FOUND:', application?._id);

    if (!application) {
      throw new NotFoundException(`Application not found for id: ${applicationId}`);
    }

    if (!Array.isArray(application.applicants) || application.applicants.length === 0) {
      throw new NotFoundException(`No applicants found for applicationId: ${applicationId}`);
    }

    console.log('👥 TOTAL APPLICANTS:', application.applicants.length);

    const results: any[] = [];

    // ✅ IMPORTANT: send emails one by one (not parallel)
    for (const applicant of application.applicants) {
      const { externalUserId, email } = applicant;

      console.log('\n==============================');
      console.log('👤 APPLICANT OBJECT:', applicant);
      console.log('🆔 externalUserId:', externalUserId);
      console.log('📧 email:', email);

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

      try {
        const appDoc = await this.applicationModel.findOne({
          'applicants.externalUserId': externalUserId,
        });

        if (!appDoc) {
          throw new Error(`Application not found for externalUserId: ${externalUserId}`);
        }

        const applicationIdFromDb = appDoc._id.toString();
        const userId = appDoc.userId;

        console.log('🔍 Finding KYC record...');
        let kyc = await this.kycModel.findOne({ externalUserId });

        console.log('📄 KYC FOUND:', kyc);

        let applicantId: string;

        if (kyc && kyc.applicantId) {
          applicantId = kyc.applicantId;
          console.log('♻️ Reusing existing applicantId:', applicantId);
        } else {
          console.log('🆕 Creating Sumsub applicant...');

          const created = await this.sumsubService.createApplicant(externalUserId, email);

          console.log('🧾 SUMSUB CREATE RESPONSE:', created);

          if (!created?.applicantId) {
            throw new Error(`Sumsub applicant creation failed`);
          }

          applicantId = created.applicantId;

          console.log('💾 Saving KYC in DB...');
          kyc = await this.kycModel.findOneAndUpdate(
            { externalUserId },
            {
              UserId: userId,
              applicationId: applicationIdFromDb,
              externalUserId,
              email,
              applicantId,
              levelName: created.levelName,
              status: KycStatus.CREATED,
            },
            { upsert: true, new: true },
          );

          console.log('💾 KYC SAVED:', kyc);
        }

        if (!applicantId) {
          throw new Error(`Failed to fetch applicantId`);
        }

        console.log('🔑 Generating SDK token...');
        const token = await this.sumsubService.generateSdkToken(applicantId);

        console.log('🎫 SDK TOKEN:', token);

        if (!token) {
          throw new Error(`SDK token is empty`);
        }

        console.log('📝 Updating KYC status...');
        if (
          kyc?.status === KycStatus.NOT_STARTED ||
          kyc?.status === KycStatus.CREATED
        ) {
          await this.kycModel.updateOne(
            { externalUserId },
            { status: KycStatus.LINK_SENT },
          );
        }

        const link = `${process.env.FRONTEND_URL}kyc?token=${token}&user=${externalUserId}&applicantId=${applicantId}&applicationId=${applicationIdFromDb}`;

        console.log('🔗 KYC LINK:', link);

        // ✅ FIXED EMAIL SENDING (IMPORTANT)
        try {
          console.log('📧 Sending email to:', email);
          await this.mailService.sendKycEmail(email, link);
          console.log('✅ Email sent:', email);

          // ✅ Delay to avoid SMTP blocking
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (err) {
          console.error('❌ Email failed:', email, err);
        }

        results.push({
          externalUserId,
          email,
          applicantId,
          link,
          status: 'SUCCESS',
        });

      } catch (applicantError: any) {
        console.error(`❌ Applicant failed: ${externalUserId}`);
        console.error('🔥 ERROR STACK:', applicantError);

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

    console.log('📊 FINAL RESULT:', results);

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

}
