import {
  Controller,
  Post,
  Body,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
    Req,
    Get,
    Query,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, HydratedDocument } from 'mongoose'; 
import { SumsubService } from '../services/sumsub.service';
import { Kyc } from '../schemas/kyc.schema';
import { KycStatus } from '../enums/kyc-status.enum';
import { Application } from '../../applications/schemas/application.schema';
import { MailService } from '../../mail/mail.service';
import { JwtAuthGuard } from './../../auth/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { AdminJwtGuard } from '../../auth/admin-jwt.guard'

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
  @UseGuards(JwtAuthGuard)
  async startKyc(@Req() req: any, @Body() body: any) {

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

      const loggedInUserId =
      req.user?.id || req.user?._id || req.user?.userId;

    console.log('loggedInUserId', loggedInUserId);

    if (!loggedInUserId) {
      throw new BadRequestException('Invalid login user');
    }

    if (application.userId.toString() !== loggedInUserId.toString()) {
      throw new BadRequestException(
        'You are not authorized to access this application',
      );
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
          let kyc: HydratedDocument<Kyc> | null = null; 

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

          // console.log(' FINAL APPLICANT ID:', {
          //   externalUserId,
          //   applicantId,
          // });

          // console.log('🔑 Generating SDK token...');
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

          const link = `${process.env.FRONTEND_URL}kyc?token=${token}&user=${externalUserId}&applicationId=${applicationIdFromDb}`;

         // console.log('🔗 KYC LINK:', link);
         // console.log('📧 Sending email to:', email);

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


@Post('client-status/update')
async saveOrUpdateKyc(@Body() body: any) {
  try {
    const { externalUserId } = body;

    //  externalUserId is mandatory
    if (!externalUserId) {
      throw new BadRequestException(
        'externalUserId is required',
      );
    }

    // ❌ Never allow Mongo _id overwrite
    delete body._id;

    //  UPDATE IF EXISTS, CREATE IF NOT (BASED ON externalUserId)
    const saved = await this.kycModel.findOneAndUpdate(
      { externalUserId }, // 🔥 THIS IS THE KEY FIX
      body,
      {
        upsert: true,
        new: true,
        runValidators: false,
        strict: false, // allows extra webhook fields safely
      },
    );

    return {
      success: true,
      action: 'UPSERTED',
      kycId: saved._id,
    };

  } catch (error: any) {
    throw new InternalServerErrorException(
      error?.message || 'Failed to save KYC data',
    );
  }
}
  @Get('details')
  @UseGuards(AdminJwtGuard)
  async getKycDetails(@Query() query: any) {
    return this.sumsubService.getKycDetails({
      page: Number(query.page || 1),
      limit: Number(query.limit || 10),
      status: query.status,
      riskLevel: query.riskLevel,
      applicantName: query.applicantName,
      applicationId: query.applicationId,
      fromDate: query.from,
      toDate: query.to,
    });
  }


    @Get('sumsub-data')

  async getSumsubData(
    @Query('applicantId') applicantId: string,
  ) {
    if (!applicantId) {
      throw new BadRequestException('applicantId is required');
    }

    const data = await this.sumsubService.getApplicantById(applicantId);

    return {
      success: true,
      data,
    };
  }

}







