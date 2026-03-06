import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import https from 'https';
import { Application } from '../../applications/schemas/application.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Kyc } from '../schemas/kyc.schema';
import { Admin } from '../../admin/schemas/admin.schema';
import { NotificationService } from '../../notification/notification.service';


@Injectable()
export class SumsubService {
  constructor(
    @InjectModel(Application.name)
    private readonly applicationModel: Model<Application>,
    @InjectModel(Kyc.name)
    private readonly kycModel: Model<Kyc>,
     @InjectModel(Admin.name)
  private adminModel: Model<Admin>,

    private notificationService: NotificationService, 

  ) {}
  private readonly baseUrl = process.env.SUMSUB_BASE_URL!;
  private readonly appToken = process.env.SUMSUB_APP_TOKEN!;
  private readonly secretKey = process.env.SUMSUB_SECRET_KEY!;
  private readonly levelName = process.env.SUMSUB_LEVEL_NAME!;

  private createSignature(method: string, path: string, ts: number, body = '') {
    const payload = ts + method.toUpperCase() + path + body;

    return crypto
      .createHmac('sha256', this.secretKey)
      .update(payload)
      .digest('hex');
  }

  private getHeaders(signature: string, ts: number) {
    return {
      'X-App-Token': this.appToken.trim(),
      'X-App-Access-Sig': signature,
      'X-App-Access-Ts': ts.toString(),
      'Content-Type': 'application/json',
    };
  }

  // ================= CREATE APPLICANT =================
  async createApplicant(externalUserId: string, email?: string) {
    try {
      externalUserId = externalUserId.trim();

      //  NEW CODE (IMPORTANT)
      const existing = await this.getApplicantByExternalUserId(externalUserId);

      if (existing?.id) {
        console.log('♻️ Existing applicant found in Sumsub:', existing.id);

        return {
          applicantId: existing.id,
          levelName: this.levelName,
          alreadyExists: true,
        };
      }

      const ts = Math.floor(Date.now() / 1000);
      const path = `/resources/applicants?levelName=${this.levelName}`;

      const bodyObj: any = { externalUserId };
      if (email) bodyObj.email = email;

      const body = JSON.stringify(bodyObj);
      const signature = this.createSignature('POST', path, ts, body);

      const res = await axios.post(this.baseUrl + path, body, {
        headers: this.getHeaders(signature, ts),
      });

      return {
        applicantId: res.data.id,
        levelName: this.levelName,
      };
    } catch (err: any) {
      const data = err?.response?.data;

      if (err?.response?.status === 409) {
        const applicant =
          await this.getApplicantByExternalUserId(externalUserId);

        const applicantId =
          applicant?.id ||
          applicant?.list?.items?.[0]?.id ||
          applicant?.items?.[0]?.id ||
          null;

        if (!applicantId) {
          throw new InternalServerErrorException(
            'Failed to fetch existing applicant',
          );
        }

        return {
          applicantId,
          levelName: this.levelName,
          alreadyExists: true,
        };
      }

      throw new InternalServerErrorException(
        data?.description || err?.message || 'Sumsub applicant creation failed',
      );
    }
  }

  // ================= GET APPLICANT =================
  async getApplicantByExternalUserId(externalUserId: string) {
    try {
      externalUserId = externalUserId.trim();

      const ts = Math.floor(Date.now() / 1000);
      const encodedId = encodeURIComponent(externalUserId);

      const path = `/resources/applicants/-;externalUserId=${encodedId}`;
      const signature = this.createSignature('GET', path, ts, '');

      const res = await axios.get(this.baseUrl + path, {
        headers: this.getHeaders(signature, ts),
      });

      return res.data;
    } catch (err) {
      return null;
    }
  }

  // ================= GENERATE SDK TOKEN =================
  async generateSdkToken(externalUserId: string, retries = 3): Promise<string> {
    try {
      externalUserId = externalUserId.trim();
      const ts = Math.floor(Date.now() / 1000);
      const query = `ttlInSecs=86400&userId=${externalUserId}&levelName=${this.levelName}`;
      const path = `/resources/accessTokens?${query}`;
      const signature = this.createSignature('POST', path, ts, '');

      const url = this.baseUrl + path;

      return await new Promise((resolve, reject) => {
        const req = https.request(
          url,
          {
            method: 'POST',
            headers: {
              'X-App-Token': this.appToken.trim(),
              'X-App-Access-Sig': signature,
              'X-App-Access-Ts': ts.toString(),
            },
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              try {
                const json = JSON.parse(data);
                if (!json.token) return reject(json);
                resolve(json.token);
              } catch (e) {
                reject(data);
              }
            });
          },
        );

        req.on('error', reject);
        req.end();
      });
    } catch (err: any) {
      if (retries > 0) {
        console.log(`🔁 Retrying Sumsub API... (${retries})`);
        await new Promise((r) => setTimeout(r, 2000));
        return this.generateSdkToken(externalUserId, retries - 1);
      }

      throw new Error(err?.message || 'Failed to generate SDK token');
    }
  }

async getKycDetails(query: {
  page?: number;
  limit?: number;
  status?: string;
  riskLevel?: string;
  applicantName?: string;
  applicationId?: string;
  dateRange?: 'today' | 'this_week' | 'this_month';
  fromDate?: string;
  toDate?: string;
}) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const skip = (page - 1) * limit;

  const pipeline: any[] = [];

  /* =====================================================
     PRE-GROUP MATCH
  ===================================================== */
  const preGroupMatch: any = {
    externalUserId: { $exists: true, $ne: null },
  };

  const now = new Date();

  if (query.dateRange === 'today') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    preGroupMatch.createdAt = { $gte: start, $lte: end };
  }

  if (query.dateRange === 'this_week') {
    const start = new Date();
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    end.setHours(23, 59, 59, 999);

    preGroupMatch.createdAt = { $gte: start, $lte: end };
  }

  if (query.dateRange === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);

    preGroupMatch.createdAt = { $gte: start, $lte: end };
  }

  if (query.fromDate || query.toDate) {
    preGroupMatch.createdAt = {};
    if (query.fromDate) {
      const from = new Date(query.fromDate);
      from.setHours(0, 0, 0, 0);
      preGroupMatch.createdAt.$gte = from;
    }
    if (query.toDate) {
      const to = new Date(query.toDate);
      to.setHours(23, 59, 59, 999);
      preGroupMatch.createdAt.$lte = to;
    }
  }

  // 🔥 PERFORMANCE FIX (before group)
  pipeline.push({ $match: preGroupMatch });

  pipeline.push({ $sort: { createdAt: -1 } });

  pipeline.push({
    $group: {
      _id: '$externalUserId',
      kyc: { $first: '$$ROOT' },
    },
  });

  /* =====================================================
     STATUS + RISK
  ===================================================== */
  const match: any = {};

  switch (query.status?.toLowerCase()) {
    case 'completed':
      match['kyc.status'] = 'APPROVED';
      break;
    case 'failed':
      match['kyc.status'] = 'REJECTED';
      break;
    case 'in progress':
      match['kyc.status'] = { $in: ['IN_PROGRESS', 'LINK_SENT'] };
      break;
    case 'not started':
      match['kyc.status'] = 'CREATED';
      break;
  }

  switch (query.riskLevel?.toLowerCase()) {
    case 'high':
      match['kyc.status'] = 'REJECTED';
      break;
    case 'low':
      match['kyc.status'] = 'APPROVED';
      break;
    case 'inprogress':
      match['kyc.status'] = { $in: ['IN_PROGRESS', 'LINK_SENT'] };
      break;
    case 'pending':
      match['kyc.status'] = 'CREATED';
      break;
  }

  if (Object.keys(match).length) {
    pipeline.push({ $match: match });
  }

  /* =====================================================
     APPLICATION LOOKUP
  ===================================================== */
  pipeline.push({
    $addFields: {
      applicationIdStr: {
        $cond: [
          { $ifNull: ['$kyc.applicationId', false] },
          { $toString: '$kyc.applicationId' },
          '',
        ],
      },
    },
  });

  pipeline.push({
    $addFields: {
      applicationObjectId: {
        $cond: [
          { $eq: [{ $strLenCP: '$applicationIdStr' }, 24] },
          { $toObjectId: '$applicationIdStr' },
          null,
        ],
      },
    },
  });

  pipeline.push({
    $lookup: {
      from: 'applications',
      localField: 'applicationObjectId',
      foreignField: '_id',
      as: 'application',
    },
  });

  pipeline.push({
    $unwind: {
      path: '$application',
      preserveNullAndEmptyArrays: true,
    },
  });

  if (query.applicationId) {
    pipeline.push({
      $match: { 'application.appId': query.applicationId },
    });
  }

  /* =====================================================
     🔥 CORRECT APPLICANT RESOLVER (ExternalUserId based)
  ===================================================== */
  pipeline.push({
    $addFields: {
      applicant: {
        $first: {
          $filter: {
            input: '$application.applicants',
            as: 'a',
            cond: {
              $eq: ['$$a.externalUserId', '$kyc.externalUserId']
            }
          }
        }
      }
    }
  });

  if (query.applicantName) {
    pipeline.push({
      $match: {
        $or: [
          { 'applicant.firstName': { $regex: query.applicantName, $options: 'i' } },
          { 'applicant.lastName': { $regex: query.applicantName, $options: 'i' } },
        ],
      },
    });
  }

  /* =====================================================
     RISK SUMMARY
  ===================================================== */
  pipeline.push({
    $addFields: {
      riskSummary: {
        $switch: {
          branches: [
            { case: { $eq: ['$kyc.status', 'APPROVED'] }, then: 'Low Risk' },
            { case: { $eq: ['$kyc.status', 'REJECTED'] }, then: 'High Risk' },
            { case: { $in: ['$kyc.status', ['IN_PROGRESS', 'LINK_SENT']] }, then: 'In Progress' },
            { case: { $eq: ['$kyc.status', 'CREATED'] }, then: 'Pending' },
          ],
          default: 'Pending',
        },
      },
    },
  });

  /* =====================================================
     FACET
  ===================================================== */
  pipeline.push({
    $facet: {
      data: [
        {
          $project: {
            _id: '$kyc._id',
            applicationId: '$application.appId',
            applicationObjectId: '$application._id',
            applicantId: '$kyc.applicantId', // source unchanged
            externalUserId: '$kyc.externalUserId',
            applicantName: {
              $trim: {
                input: {
                  $concat: [
                    { $ifNull: ['$applicant.firstName', ''] },
                    ' ',
                    { $ifNull: ['$applicant.lastName', ''] },
                  ],
                },
              },
            },
            provider: { $literal: 'Sumsub' },
            status: '$kyc.status',
            startedOn: '$kyc.createdAt',
            completedOn: '$kyc.kycCompletedAt',
            riskSummary: 1,
          },
        },
        { $sort: { startedOn: -1 } },
        { $skip: skip },
        { $limit: limit },
      ],
      total: [{ $count: 'count' }],
      cards: [
        {
          $group: {
            _id: null,
            totalChecks: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$kyc.status', 'APPROVED'] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ['$kyc.status', 'REJECTED'] }, 1, 0] } },
            inProgress: {
              $sum: { $cond: [{ $in: ['$kyc.status', ['IN_PROGRESS', 'LINK_SENT']] }, 1, 0] },
            },
            lowRisk: { $sum: { $cond: [{ $eq: ['$kyc.status', 'APPROVED'] }, 1, 0] } },
          },
        },
      ],
    },
  });

  const [result] = await this.kycModel.aggregate(pipeline);

  return {
    success: true,
    cards: result?.cards?.[0] || {
      totalChecks: 0,
      completed: 0,
      failed: 0,
      inProgress: 0,
      lowRisk: 0,
    },
    data: result?.data || [],
    total: result?.total?.[0]?.count || 0,
    page,
    limit,
  };
}

async getApplicantById(applicantId: string) {
  try {
    if (!applicantId) {
      throw new BadRequestException('applicantId is required');
    }
// ============================================
// 🔎 FETCH KYC RECORD (for expiry validation)
// ============================================
const kycRecordForExpiry = await this.kycModel
  .findOne({ applicantId })
  .lean();

// if (!kycRecordForExpiry) {
//   throw new NotFoundException('KYC record not found');
// }

// // ============================================
// // ✅ LINK EXPIRY VALIDATION (5 min + 1 min grace)
// // ============================================
// if (!kycRecordForExpiry.linkExpiresAt) {
//   throw new BadRequestException('KYC link is invalid');
// }

// // 1 minute grace period
// const expiryWithGrace = new Date(
//   new Date(kycRecordForExpiry.linkExpiresAt).getTime() + 60 * 1000
// );

// if (new Date() > expiryWithGrace) {
//   throw new BadRequestException('KYC link expired');
// }
    // ============================================
    // 🔐 Create Sumsub Signature
    // ============================================
    const ts = Math.floor(Date.now() / 1000);
    const path = `/resources/applicants/${applicantId}/one`;
    const signature = this.createSignature('GET', path, ts);

    // ============================================
    // 📡 Call Sumsub API
    // ============================================
    const res = await axios.get(this.baseUrl + path, {
      headers: this.getHeaders(signature, ts),
      timeout: 10000,
    });

    const applicantData = res.data;

    const reviewStatus =
      applicantData?.review?.reviewStatus || 'unknown';

    const reviewResult =
      applicantData?.review?.reviewResult?.reviewAnswer || 'pending';

    const externalUserId =
      applicantData?.externalUserId || 'N/A';

    // ============================================
    // 🔎 Get KYC Record (fetch applicationId)
    // ============================================
    const kycRecord = await this.kycModel
      .findOne({ applicantId })
      .lean();

    if (!kycRecord) {
      throw new NotFoundException('KYC record not found');
    }

    const applicationId = kycRecord?.applicationId;

    // ============================================
    // 🔎 Get Application Record (fetch userId)
    // ============================================
    const application = await this.applicationModel
      .findById(applicationId)
      .select('userId')
      .lean();

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const userId = application.userId;

    // ============================================
    // 📢 USER FRIENDLY MESSAGE
    // ============================================
    let userMessage = '';
    let adminMessage = '';

    if (reviewResult === 'GREEN') {
      userMessage = `✅ Your KYC has been successfully approved.`;
      adminMessage = `KYC APPROVED | Application ID: ${applicationId} | Status: APPROVED`;
    } 
    else if (reviewResult === 'RED') {
      userMessage = `❌ Your KYC has been rejected. Please review and resubmit your documents.`;
      adminMessage = `KYC REJECTED | Application ID: ${applicationId} | Status: REJECTED`;
    } 
    else {
      userMessage = `⏳ Your KYC is currently under review.`;
      adminMessage = `KYC PENDING | Application ID: ${applicationId} | Status: PENDING`;
    }

    // ============================================
    // 🔔 SEND USER NOTIFICATION
    // ============================================
    await this.notificationService.sendToUser({
      userId: userId.toString(),
      message: userMessage,
      stage: 'kyc_status_update',
      type: 'kyc',
      applicationId: applicationId,
    });

    // ============================================
    // 🔔 SEND ADMIN NOTIFICATION
    // ============================================
    const superAdmin = await this.adminModel
      .findOne({ role: 'super_admin' })
      .select('_id')
      .lean();

    if (superAdmin?._id) {
      await this.notificationService.sendToAdmin({
        adminId: superAdmin._id.toString(),
        message: adminMessage,
        stage: 'kyc_status_update',
        type: 'kyc',
        applicationId: applicationId,
      });
    }

    return applicantData;

  } catch (err: any) {

    if (err?.response) {
      const status = err.response.status;
      const message =
        err.response.data?.description ||
        err.response.data?.error ||
        'Sumsub API error';

      switch (status) {
        case 400:
          throw new BadRequestException(message);
        case 401:
        case 403:
          throw new UnauthorizedException('Unauthorized with Sumsub API');
        case 404:
          throw new NotFoundException('Applicant not found');
        default:
          throw new InternalServerErrorException(message);
      }
    }

    if (err?.code === 'ECONNABORTED') {
      throw new InternalServerErrorException('Sumsub timeout');
    }

    throw new InternalServerErrorException(err?.message);
  }
}

async checkApplicationKycStatus(applicationId: string) {

  if (!applicationId) {
    throw new BadRequestException('applicationId is required');
  }

  const application = await this.applicationModel.findById(applicationId).lean();

  if (!application) {
    throw new NotFoundException('Application not found');
  }

  const applicants = application.applicants || [];

  if (applicants.length === 0) {
    throw new BadRequestException('No applicants found');
  }

  const externalIds = applicants
    .map((a: any) => a.externalUserId)
    .filter(Boolean);

  const kycs: any[] = await this.kycModel
    .find({ externalUserId: { $in: externalIds } })
    .lean();

  let allKycCompleted = true;

  const results = applicants.map((applicant: any) => {

    const kyc: any = kycs.find(
      (k: any) => k.externalUserId === applicant.externalUserId
    );

    const completed =
      kyc &&
      kyc.webresponse &&
      Object.keys(kyc.webresponse || {}).length > 0 &&
      kyc.rawWebhookPayload &&
      Object.keys(kyc.rawWebhookPayload || {}).length > 0;

    if (!completed) {
      allKycCompleted = false;
    }

    return {
      applicantId: kyc?.applicantId || null,
      kycCompleted: !!completed,
    };
  });

  /* ===============================
     EXPIRY LOGIC
  =============================== */

  const expiryDays = Number(process.env.KYC_LINK_EXPIRY_DAYS || 2);

  // current time + env days
  const expiresAt = new Date(
    Date.now() + expiryDays * 24 * 60 * 60 * 1000
  );

  // get DB expiry time (if exists)
  const expireslinktime =
    kycs.find(k => k.linkExpiresAt)?.linkExpiresAt || null;

  return {
    success: true,
    applicationId,
    allApplicantsKycCompleted: allKycCompleted,
    showKycLink: !allKycCompleted,
    message: allKycCompleted
      ? 'All applicants KYC completed'
      : 'KYC pending for one or more applicants',
    applicants: results,

    expired: false,
    endTime: expiresAt,
    startTime: expireslinktime
  };
}
}



