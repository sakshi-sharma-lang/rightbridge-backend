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

    //  console.log('🚀 START KYC REQUEST:', body);

      if (!applicationId || typeof applicationId !== 'string') {
        throw new BadRequestException('applicationId is required and must be a string');
      }

      const application = await this.applicationModel.findById(applicationId);

      if (!application) {
        throw new NotFoundException(`Application not found: ${applicationId}`);
      }

      if (!Array.isArray(application.applicants) || application.applicants.length === 0) {
        throw new NotFoundException(`No applicants found in application`);
      }

      //console.log('👥 TOTAL APPLICANTS:', application.applicants.length);

      const results: any[] = [];

      // ✅ Process applicants one by one (safe for SMTP)
      for (const applicant of application.applicants) {
        const { externalUserId, email } = applicant;

       // console.log('\n==============================');
       // console.log('👤 APPLICANT:', applicant);

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
          const applicationIdFromDb = application._id.toString();
          const userId = application.userId;

          // ✅ Find existing KYC record
          let kyc = await this.kycModel.findOne({ externalUserId });

          let applicantId: string;

          // ✅ Reuse applicantId if exists
          if (kyc?.applicantId) {
            applicantId = kyc.applicantId;
           // console.log('♻️ Reusing applicantId:', applicantId);
          } else {
            //  console.log('🆕 Creating Sumsub applicant...');

            const created = await this.sumsubService.createApplicant(externalUserId, email);

            if (!created?.applicantId) {
              throw new Error('Sumsub applicant creation failed');
            }

            applicantId = created.applicantId;

            // ✅ Save KYC in DB
            kyc = await this.kycModel.findOneAndUpdate(
              { externalUserId },
              {
                userId: userId, // ✅ FIXED (was UserId)
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
            throw new Error('ApplicantId not found');
          }

          // ✅ ALWAYS generate new SDK token
          console.log('🔑 Generating SDK token...');
          const token = await this.sumsubService.generateSdkToken(applicantId);

          if (!token) {
            throw new Error('SDK token generation failed');
          }

         // console.log('🎫 SDK TOKEN GENERATED');

          // ✅ ALWAYS update status + resend link
          await this.kycModel.updateOne(
            { externalUserId },
            {
              status: KycStatus.LINK_SENT,
              lastLinkSentAt: new Date(), // optional but useful
            },
          );

          // ✅ FIXED LINK (added / before kyc)
          const link = `${process.env.FRONTEND_URL}/kyc?token=${token}&user=${externalUserId}&applicationId=${applicationIdFromDb}`;

          console.log('🔗 KYC LINK:', link);

         console.log('📧 Sending email to:', email);

       const mailResult = await this.mailService.sendKycEmail(email, link);

if (!mailResult.success) {
  console.error('❌ Email failed:', email, mailResult.error);

  results.push({
    externalUserId,
    email,
    applicantId,
    link,
    status: 'EMAIL_FAILED',
    error: mailResult.error,
  });

  continue;
}

console.log('✅ Email sent:', email);

// ✅ ADD DELAY HERE (IMPORTANT)
await new Promise(resolve => setTimeout(resolve, 2000)); // 2 seconds

          results.push({
            externalUserId,
            email,
            applicantId,
            link,
            status: 'SUCCESS',
          });

        } catch (err: any) {
          console.error('❌ Applicant failed:', externalUserId, err);

          results.push({
            externalUserId,
            email,
            applicantId: '',
            link: '',
            status: 'FAILED',
            error: err?.message,
          });
        }
      }

    //  console.log('📊 FINAL RESULT:', results);

      return {
        success: true,
        applicationId,
        totalApplicants: application.applicants.length,
        successCount: results.filter(r => r.status === 'SUCCESS').length,
        failedCount: results.filter(r => r.status === 'FAILED').length,
        results,
      };

    } catch (error: any) {
     // console.error('❌ START KYC ERROR:', error);

      throw new InternalServerErrorException(
        error?.message || 'Failed to start KYC process',
      );
    }
  }
}
