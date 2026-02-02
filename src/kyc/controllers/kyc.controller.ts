import {
  Controller,
  Post,
  Body,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, HydratedDocument } from 'mongoose'; // ✅ FIXED
import { SumsubService } from '../services/sumsub.service';
import { Kyc } from '../schemas/kyc.schema';
import { KycStatus } from '../enums/kyc-status.enum';
import { Application } from '../../applications/schemas/application.schema';
import { MailService } from '../../mail/mail.service';

@Controller('kyc')
export class KycController { // ✅ FIXED (export added)
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

      const results: any[] = [];

      for (const applicant of application.applicants) {
        const { externalUserId, email } = applicant;

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
          let kyc: HydratedDocument<Kyc> | null = null; // ✅ FIXED

          kyc = await this.kycModel.findOne({ externalUserId });

          let applicantId: string = '';

          if (kyc?.applicantId) {
            applicantId = kyc.applicantId;

            const sumsubApplicant =
              await this.sumsubService.getApplicantByExternalUserId(externalUserId);

            if (!sumsubApplicant?.id) {
              console.log('⚠️ ApplicantId in DB is invalid, recreating...');
              applicantId = '';
            }
          }

          if (!applicantId) {
            const created = await this.sumsubService.createApplicant(externalUserId, email);

            if (!created?.applicantId) {
              throw new Error('Sumsub applicant creation failed');
            }

            applicantId = created.applicantId;

            kyc = await this.kycModel.findOneAndUpdate(
              { externalUserId },
              {
                userId: userId,
                applicationId: applicationIdFromDb,
                externalUserId,
                email,
                applicantId,
                levelName: created.levelName,
                status: KycStatus.CREATED,
              },
              { upsert: true, new: true },
            );
          }

          if (!applicantId) {
            throw new Error('ApplicantId not found');
          }

          console.log('✅ FINAL APPLICANT ID:', {
            externalUserId,
            applicantId,
          });

          console.log('🔑 Generating SDK token...');
          const token = await this.sumsubService.generateSdkToken(externalUserId);

          if (!token) {
            throw new Error('SDK token generation failed');
          }

          await this.kycModel.updateOne(
            { externalUserId },
            {
              status: KycStatus.LINK_SENT,
              lastLinkSentAt: new Date(),
            },
          );

          const link = `${process.env.FRONTEND_URL}kyc?token=${token}&user=${externalUserId}&applicationId=${applicationIdFromDb}&applicantId=${applicantId}`;

          console.log('🔗 KYC LINK:', link);
          console.log('📧 Sending email to:', email);

          const mailResult = await this.mailService.sendKycEmail(email, link);

          if (!mailResult.success) {
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

          await new Promise(resolve => setTimeout(resolve, 2000));

          results.push({
            externalUserId,
            email,
            applicantId,
            link,
            status: 'SUCCESS',
          });

        } catch (err: any) {
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

      return {
        success: true,
        applicationId,
        totalApplicants: application.applicants.length,
        successCount: results.filter(r => r.status === 'SUCCESS').length,
        failedCount: results.filter(r => r.status === 'FAILED').length,
        results,
      };

    } catch (error: any) {
      throw new InternalServerErrorException(
        error?.message || 'Failed to start KYC process',
      );
    }
  }
}
