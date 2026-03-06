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
import { AdminJwtGuard } from '../../auth/admin-jwt.guard';

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
        throw new BadRequestException(
          'applicationId is required and must be a string',
        );
      }

      const application = await this.applicationModel.findById(applicationId);

      if (!application) {
        throw new NotFoundException(`Application not found: ${applicationId}`);
      }

      if (
        !Array.isArray(application.applicants) ||
        application.applicants.length === 0
      ) {
        throw new NotFoundException(`No applicants found in application`);
      }

      const loggedInUserId = req.user?.id || req.user?._id || req.user?.userId;

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

          //  Find existing KYC record
          let kyc: HydratedDocument<Kyc> | null = null;

          kyc = await this.kycModel.findOne({ externalUserId });
            if (
          kyc &&
          kyc.webresponse &&
          Object.keys(kyc.webresponse).length > 0
        ) {
          results.push({
            externalUserId,
            email,
            applicantId: kyc?.applicantId || '',
            link: '',
            status: 'KYC_ALREADY_COMPLETED'
          });

          continue;
        }

          let applicantId: string = '';

          if (kyc?.applicantId) {
            applicantId = kyc.applicantId;

            const sumsubApplicant =
              await this.sumsubService.getApplicantByExternalUserId(
                externalUserId,
              );

            if (!sumsubApplicant?.id) {
              console.log('⚠️ ApplicantId in DB is invalid, recreating...');
              applicantId = '';
            }
          }

          if (!applicantId) {
            const created = await this.sumsubService.createApplicant(
              externalUserId,
              email,
            );

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
          const token =
            await this.sumsubService.generateSdkToken(externalUserId);

          if (!token) {
            throw new Error('SDK token generation failed');
          }

      const expiresAt = new Date(Date.now() + 60000); // 1 minute

        await this.kycModel.updateOne(
          { externalUserId },
          {
            status: KycStatus.LINK_SENT,
            lastLinkSentAt: new Date(),
            linkExpiresAt: expiresAt, 
          },
        );

         // const link = `${process.env.FRONTEND_URL}kyc?token=${token}&user=${externalUserId}&applicationId=${applicationIdFromDb}&applicantId=${applicantId}`;
           const link = `http://localhost:3093/kyc?token=${token}&user=${externalUserId}&applicationId=${applicationIdFromDb}&applicantId=${applicantId}`;
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

          await new Promise((resolve) => setTimeout(resolve, 2000));

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
        successCount: results.filter((r) => r.status === 'SUCCESS').length,
        failedCount: results.filter((r) => r.status === 'FAILED').length,
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
    const { applicantId } = body;

    if (!applicantId) {
      throw new BadRequestException('applicantId is required');
    }

    // never allow _id overwrite
    delete body._id;

    const updated = await this.kycModel.findOneAndUpdate(
      { applicantId: applicantId },   // 🔴 match ONLY by applicantId
      { $set: body },
      {
        new: true,
        upsert: false,               // 🔴 DO NOT create new record
        runValidators: false,
        strict: false,
      },
    );

    if (!updated) {
      throw new BadRequestException(
        `No record found for applicantId ${applicantId}`,
      );
    }

    return {
      success: true,
      message: 'KYC updated successfully',
      action: 'UPDATED',
      kycId: updated._id,
    };
  } catch (error: any) {
    throw new InternalServerErrorException(
      error?.message || 'Failed to update KYC data',
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
      dateRange: query.dateRange,
      fromDate: query.fromDate,
      toDate: query.toDate,
    });
  }

@Get('sumsub-data')
@UseGuards(UseGuards)
async getSumsubData(@Query('applicantId') applicantId: string) {
  try {
    // ===== VALIDATION =====
    if (!applicantId || applicantId.trim() === '') {
      throw new BadRequestException('applicantId query parameter is required');
    }

    // ===== FIND RECORD =====
    const kyc = await this.kycModel.findOne({ applicantId }).lean();

    // ===== NOT FOUND =====
    if (!kyc) {
      throw new NotFoundException(
        `No KYC record found for applicantId: ${applicantId}`,
      );
    }

    // ===== SUCCESS =====
    return {
      success: true,
      message: 'KYC data fetched successfully',
      data: kyc,
    };
  } catch (error: any) {
    // known errors
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException
    ) {
      throw error;
    }

    // unknown error
    throw new InternalServerErrorException(
      error?.message || 'Unable to fetch KYC data at the moment',
    );
  }
}

@Get('sumsub/applicant/data')
async getApplicant(@Query('applicantId') applicantId: string) {
  return this.sumsubService.getApplicantById(applicantId);
}

@Get('status/details')
@UseGuards(AdminJwtGuard) 
async getKycByApplicationId(
  @Query('applicationId') applicationId: string,
) {
  try {
    if (!applicationId || applicationId.trim() === '') {
      throw new BadRequestException(
        'applicationId query parameter is required',
      );
    }

    // Find ALL KYC records for this application
    const kycRecords = await this.kycModel
      .find({ applicationId })
      .sort({ createdAt: -1 })
      .lean();

    if (!kycRecords || kycRecords.length === 0) {
      throw new NotFoundException(
        `No KYC records found for applicationId: ${applicationId}`,
      );
    }

    /* ==========================================
       🔥 ADD RISK LABEL
    ========================================== */
    const dataWithRisk = kycRecords.map((kyc) => {
      let riskLabel = 'Pending';

      switch (kyc.status) {
        case 'APPROVED':
          riskLabel = 'Low Risk';
          break;
        case 'REJECTED':
          riskLabel = 'High Risk';
          break;
        case 'IN_PROGRESS':
        case 'LINK_SENT':
          riskLabel = 'In Progress';
          break;
        case 'CREATED':
          riskLabel = 'Pending';
          break;
      }

      return {
        ...kyc,
        riskLabel, // 👈 added key
      };
    });

    return {
      success: true,
      message: 'KYC records fetched successfully',
      total: dataWithRisk.length,
      data: dataWithRisk,
    };
  } catch (error: any) {
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException
    ) {
      throw error;
    }

    throw new InternalServerErrorException(
      error?.message || 'Unable to fetch KYC records',
    );
  }
}



@Get('validate-link')
  async validateKycLink(@Query('user') externalUserId: string) {

    // 1️⃣ Validate query param
    if (!externalUserId) {
      throw new BadRequestException('User is required');
    }

    // 2️⃣ Find KYC record
    const kyc = await this.kycModel.findOne({ externalUserId });

    if (!kyc) {
      throw new NotFoundException('KYC record not found');
    }

    // 3️⃣ Check if expiry exists
    if (!kyc.linkExpiresAt) {
      return {
        success: false,
        expired: true,
        message: 'Invalid KYC link',
      };
    }

    // 4️⃣ Check expiry
    const now = new Date();
    const isExpired = now > kyc.linkExpiresAt;

    // 5️⃣ Update DB status if expired
    if (isExpired) {
      await this.kycModel.updateOne(
        { externalUserId },
        { status: KycStatus.EXPIRED },
      );
    }

    // -----------------------------
    // 6️⃣ Dynamic expiry calculation
    // -----------------------------

    const expiry = process.env.KYC_LINK_EXPIRY || '10m';

    const value = parseInt(expiry);
    const unit = expiry.slice(-1);

    let duration = 0;

    if (unit === 'm') {
      duration = value * 60 * 1000;
    } 
    else if (unit === 'h') {
      duration = value * 60 * 60 * 1000;
    } 
    else if (unit === 'd') {
      duration = value * 24 * 60 * 60 * 1000;
    } 
    else {
      duration = value * 60 * 1000;
    }

    // calculate new expiry based on existing link expiry
    const expireslinktime = new Date(kyc.linkExpiresAt.getTime() + duration);

    // 7️⃣ Return response
    return {
      success: true,
      expired: isExpired,
      expiresAt: kyc.linkExpiresAt,
      expireslinktime,
    };
  }



@Get('application/kyc-status')
@UseGuards(JwtAuthGuard)
async getApplicationKycStatus(
  @Query('applicationId') applicationId: string,
  @Req() req: any,
) {

  if (!applicationId) {
    throw new BadRequestException('applicationId is required');
  }

  return this.sumsubService.checkApplicationKycStatus(applicationId);
}

}
