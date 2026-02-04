import { Injectable, InternalServerErrorException ,NotFoundException ,UnauthorizedException ,BadRequestException } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import https from 'https';
import { Application } from '../../applications/schemas/application.schema';
import { InjectModel } from '@nestjs/mongoose';   
import { Model } from 'mongoose'; 
import { Kyc } from '../schemas/kyc.schema';

@Injectable()
export class SumsubService {
    constructor(
    @InjectModel(Application.name)
    private readonly applicationModel: Model<Application>,
    @InjectModel(Kyc.name)                    
    private readonly kycModel: Model<Kyc>,    
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

    // ✅ NEW CODE (IMPORTANT)
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
      const applicant = await this.getApplicantByExternalUserId(externalUserId);

      const applicantId =
        applicant?.id ||
        applicant?.list?.items?.[0]?.id ||
        applicant?.items?.[0]?.id ||
        null;

      if (!applicantId) {
        throw new InternalServerErrorException('Failed to fetch existing applicant');
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
      await new Promise(r => setTimeout(r, 2000));
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
     BASE FILTER
     (provider DOES NOT exist in DB)
  ===================================================== */
  pipeline.push({
    $match: {
      externalUserId: { $exists: true, $ne: null },
    },
  });

  /* =====================================================
     SORT FIRST (IMPORTANT FOR GROUP)
  ===================================================== */
  pipeline.push({ $sort: { createdAt: -1 } });

  /* =====================================================
     GROUP → ONE ROW PER APPLICANT
  ===================================================== */
  pipeline.push({
    $group: {
      _id: '$externalUserId',
      kyc: { $first: '$$ROOT' },
    },
  });

  /* =====================================================
     DATE FILTERS
  ===================================================== */
  const match: any = {};
  const now = new Date();

  if (query.dateRange === 'today') {
    const s = new Date();
    s.setHours(0, 0, 0, 0);
    match['kyc.createdAt'] = { $gte: s };
  }

  if (query.dateRange === 'this_week') {
    const s = new Date();
    s.setDate(s.getDate() - s.getDay());
    s.setHours(0, 0, 0, 0);
    match['kyc.createdAt'] = { $gte: s };
  }

  if (query.dateRange === 'this_month') {
    match['kyc.createdAt'] = {
      $gte: new Date(now.getFullYear(), now.getMonth(), 1),
    };
  }

  if (query.fromDate || query.toDate) {
    match['kyc.createdAt'] = {};
    if (query.fromDate) match['kyc.createdAt'].$gte = new Date(query.fromDate);
    if (query.toDate) match['kyc.createdAt'].$lte = new Date(query.toDate);
  }

  /* =====================================================
     STATUS FILTER (MATCHES YOUR DB)
  ===================================================== */
  switch (query.status?.toLowerCase()) {
    case 'completed':
      match['kyc.finalDecision'] = 'APPROVED';
      break;

    case 'failed':
      match['kyc.finalDecision'] = 'REJECTED';
      break;

    case 'in progress':
      match['kyc.status'] = 'IN_PROGRESS';
      match['kyc.finalDecision'] = { $exists: false };
      break;

    case 'not started':
      match['kyc.status'] = { $in: ['CREATED', 'LINK_SENT'] };
      break;
  }

  if (Object.keys(match).length) {
    pipeline.push({ $match: match });
  }

  /* =====================================================
     SAFE applicationId → STRING
     (PREVENTS $strLenCP CRASH)
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

  /* =====================================================
     SAFE applicationId → ObjectId
  ===================================================== */
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

  /* =====================================================
     LOOKUP APPLICATION
  ===================================================== */
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

  /* =====================================================
     RESOLVE APPLICANT VIA externalUserId
  ===================================================== */
  pipeline.push({
    $addFields: {
      applicant: {
        $first: {
          $filter: {
            input: '$application.applicants',
            as: 'a',
            cond: { $eq: ['$$a.externalUserId', '$kyc.externalUserId'] },
          },
        },
      },
    },
  });

  /* =====================================================
     RISK SUMMARY (UI LOGIC)
  ===================================================== */
  pipeline.push({
    $addFields: {
      riskSummary: {
        $switch: {
          branches: [
            {
              case: { $eq: ['$kyc.finalDecision', 'APPROVED'] },
              then: 'Low Risk',
            },
            {
              case: { $eq: ['$kyc.finalDecision', 'REJECTED'] },
              then: 'High Risk',
            },
          ],
          default: 'Pending',
        },
      },
    },
  });

  /* =====================================================
     FACET → DATA + TOTAL + CARDS
  ===================================================== */
  pipeline.push({
    $facet: {
      data: [
        {
          $project: {
            _id: 0,
            applicationId: '$application.appId',
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
            provider: { $literal: 'Sumsub' }, // UI only
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

            completed: {
              $sum: {
                $cond: [{ $eq: ['$kyc.finalDecision', 'APPROVED'] }, 1, 0],
              },
            },

            failed: {
              $sum: {
                $cond: [{ $eq: ['$kyc.finalDecision', 'REJECTED'] }, 1, 0],
              },
            },

            inProgress: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$kyc.status', 'IN_PROGRESS'] },
                      { $not: ['$kyc.finalDecision'] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            lowRisk: {
              $sum: {
                $cond: [{ $eq: ['$kyc.finalDecision', 'APPROVED'] }, 1, 0],
              },
            },
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

    const ts = Math.floor(Date.now() / 1000);
    const path = `/resources/applicants/${applicantId}/one`;
    const signature = this.createSignature('GET', path, ts);

    const res = await axios.get(this.baseUrl + path, {
      headers: this.getHeaders(signature, ts),
      timeout: 10000, // ⏱️ prevent hanging requests
    });

    return res.data;

  } catch (err: any) {
    // Axios error
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
          throw new UnauthorizedException(
            'Unauthorized with Sumsub API',
          );

        case 404:
          throw new NotFoundException(
            'Applicant not found in Sumsub',
          );

        default:
          throw new InternalServerErrorException(message);
      }
    }

    // Network / timeout error
    if (err?.code === 'ECONNABORTED') {
      throw new InternalServerErrorException(
        'Sumsub API timeout',
      );
    }

    // Fallback
    throw new InternalServerErrorException(
      err?.message || 'Failed to fetch Sumsub data',
    );
  }


}
}






