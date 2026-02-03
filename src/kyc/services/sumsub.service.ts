import { Injectable, InternalServerErrorException } from '@nestjs/common';
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
  fromDate?: string;
  toDate?: string;
}) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const skip = (page - 1) * limit;

  /* =====================================================
     BUILD PIPELINE STEP BY STEP
  ===================================================== */
  const pipeline: any[] = [];

  /* =====================================================
     ALWAYS SORT FIRST (LATEST RECORD WINS)
  ===================================================== */
  pipeline.push({ $sort: { createdAt: -1 } });

  /* =====================================================
     ONE LATEST KYC PER APPLICANT
  ===================================================== */
  pipeline.push({
    $group: {
      _id: '$externalUserId',
      kyc: { $first: '$$ROOT' },
    },
  });

  /* =====================================================
     APPLY STATUS + DATE FILTERS (CRITICAL)
  ===================================================== */
  const matchAfterGroup: any = {};

  // ---------- STATUS ----------
  const uiStatus = query.status?.toLowerCase();
  if (uiStatus) {
    switch (uiStatus) {
      case 'completed':
        matchAfterGroup['kyc.finalDecision'] = 'APPROVED';
        break;

      case 'failed':
        matchAfterGroup['kyc.finalDecision'] = 'REJECTED';
        break;

      case 'in progress':
        matchAfterGroup['kyc.status'] = {
          $in: ['LINK_SENT', 'IN_PROGRESS', 'PENDING'],
        };
        break;

      case 'not started':
        matchAfterGroup['kyc.status'] = {
          $in: ['CREATED', 'NOT_STARTED'],
        };
        break;
    }
  }

  // ---------- DATE (Started On = createdAt) ----------
  if (query.fromDate || query.toDate) {
    matchAfterGroup['kyc.createdAt'] = {};

    if (query.fromDate) {
      const from = new Date(query.fromDate);
      if (!isNaN(from.getTime())) {
        matchAfterGroup['kyc.createdAt'].$gte = from;
      }
    }

    if (query.toDate) {
      const to = new Date(query.toDate);
      if (!isNaN(to.getTime())) {
        matchAfterGroup['kyc.createdAt'].$lte = to;
      }
    }
  }

  // 🔑 THIS LINE MAKES FILTERS WORK
  if (Object.keys(matchAfterGroup).length > 0) {
    pipeline.push({ $match: matchAfterGroup });
  }

  /* =====================================================
     JOIN APPLICATION
  ===================================================== */
  pipeline.push(
    {
      $lookup: {
        from: 'applications',
        let: { appObjId: { $toObjectId: '$kyc.applicationId' } },
        pipeline: [
          { $match: { $expr: { $eq: ['$_id', '$$appObjId'] } } },
        ],
        as: 'application',
      },
    },
    { $unwind: '$application' }
  );

  /* =====================================================
     FILTER BY APPLICATION ID
  ===================================================== */
  if (query.applicationId) {
    pipeline.push({
      $match: { 'application.appId': query.applicationId },
    });
  }

  /* =====================================================
     RESOLVE APPLICANT
  ===================================================== */
  pipeline.push({
    $addFields: {
      applicant: {
        $arrayElemAt: [
          {
            $filter: {
              input: '$application.applicants',
              as: 'a',
              cond: {
                $eq: ['$$a.externalUserId', '$kyc.externalUserId'],
              },
            },
          },
          0,
        ],
      },
    },
  });

  /* =====================================================
     APPLICANT NAME SEARCH
  ===================================================== */
  if (query.applicantName) {
    pipeline.push({
      $match: {
        $expr: {
          $regexMatch: {
            input: {
              $concat: [
                { $ifNull: ['$applicant.firstName', ''] },
                ' ',
                { $ifNull: ['$applicant.lastName', ''] },
              ],
            },
            regex: query.applicantName,
            options: 'i',
          },
        },
      },
    });
  }

  /* =====================================================
     NORMALIZE RISK SUMMARY
  ===================================================== */
  pipeline.push({
    $addFields: {
      riskSummary: {
        $switch: {
          branches: [
            {
              case: {
                $or: [
                  { $eq: ['$kyc.finalDecision', 'APPROVED'] },
                  { $eq: ['$kyc.reviewAnswer', 'GREEN'] },
                ],
              },
              then: 'Low Risk',
            },
            {
              case: { $eq: ['$kyc.reviewAnswer', 'YELLOW'] },
              then: 'Medium Risk',
            },
            {
              case: {
                $or: [
                  { $eq: ['$kyc.finalDecision', 'REJECTED'] },
                  { $eq: ['$kyc.reviewAnswer', 'RED'] },
                ],
              },
              then: 'High Risk',
            },
          ],
          default: 'Pending',
        },
      },
    },
  });

  /* =====================================================
     RISK LEVEL FILTER
  ===================================================== */
  if (query.riskLevel) {
    pipeline.push({ $match: { riskSummary: query.riskLevel } });
  }

  /* =====================================================
     FACET (DATA / TOTAL / CARDS)
  ===================================================== */
  pipeline.push({
    $facet: {
      data: [
        {
          $project: {
            _id: 0,
            applicationObjectId: '$application._id',
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

            completed: {
              $sum: {
                $cond: [
                  { $eq: ['$kyc.finalDecision', 'APPROVED'] },
                  1,
                  0,
                ],
              },
            },

            failed: {
              $sum: {
                $cond: [
                  { $eq: ['$kyc.finalDecision', 'REJECTED'] },
                  1,
                  0,
                ],
              },
            },

            inProgress: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      '$kyc.status',
                      ['LINK_SENT', 'IN_PROGRESS', 'PENDING'],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            lowRisk: {
              $sum: {
                $cond: [{ $eq: ['$riskSummary', 'Low Risk'] }, 1, 0],
              },
            },
          },
        },
      ],
    },
  });

  /* =====================================================
     EXECUTE QUERY
  ===================================================== */
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

  // ---------- DATE (Started On = createdAt) ----------
  if (query.fromDate || query.toDate) {
    matchAfterGroup['kyc.createdAt'] = {};
    if (query.fromDate) {
      matchAfterGroup['kyc.createdAt'].$gte = new Date(query.fromDate);
    }
    if (query.toDate) {
      matchAfterGroup['kyc.createdAt'].$lte = new Date(query.toDate);
    }
  }

  if (Object.keys(matchAfterGroup).length) {
    pipeline.push({ $match: matchAfterGroup });
  }

  /* =====================================================
     JOIN APPLICATION
  ===================================================== */
  pipeline.push(
    {
      $lookup: {
        from: 'applications',
        let: { appObjId: { $toObjectId: '$kyc.applicationId' } },
        pipeline: [
          { $match: { $expr: { $eq: ['$_id', '$$appObjId'] } } },
        ],
        as: 'application',
      },
    },
    { $unwind: '$application' }
  );

  /* =====================================================
     FILTER BY APPLICATION ID
  ===================================================== */
  if (query.applicationId) {
    pipeline.push({
      $match: { 'application.appId': query.applicationId },
    });
  }

  /* =====================================================
     RESOLVE APPLICANT
  ===================================================== */
  pipeline.push({
    $addFields: {
      applicant: {
        $arrayElemAt: [
          {
            $filter: {
              input: '$application.applicants',
              as: 'a',
              cond: {
                $eq: ['$$a.externalUserId', '$kyc.externalUserId'],
              },
            },
          },
          0,
        ],
      },
    },
  });

  /* =====================================================
     APPLICANT NAME SEARCH
  ===================================================== */
  if (query.applicantName) {
    pipeline.push({
      $match: {
        $expr: {
          $regexMatch: {
            input: {
              $concat: [
                { $ifNull: ['$applicant.firstName', ''] },
                ' ',
                { $ifNull: ['$applicant.lastName', ''] },
              ],
            },
            regex: query.applicantName,
            options: 'i',
          },
        },
      },
    });
  }

  /* =====================================================
     NORMALIZE RISK SUMMARY
  ===================================================== */
  pipeline.push({
    $addFields: {
      riskSummary: {
        $switch: {
          branches: [
            {
              case: {
                $or: [
                  { $eq: ['$kyc.finalDecision', 'APPROVED'] },
                  { $eq: ['$kyc.reviewAnswer', 'GREEN'] },
                ],
              },
              then: 'Low Risk',
            },
            {
              case: { $eq: ['$kyc.reviewAnswer', 'YELLOW'] },
              then: 'Medium Risk',
            },
            {
              case: {
                $or: [
                  { $eq: ['$kyc.finalDecision', 'REJECTED'] },
                  { $eq: ['$kyc.reviewAnswer', 'RED'] },
                ],
              },
              then: 'High Risk',
            },
          ],
          default: 'Pending',
        },
      },
    },
  });

  /* =====================================================
     RISK LEVEL FILTER
  ===================================================== */
  if (query.riskLevel) {
    pipeline.push({ $match: { riskSummary: query.riskLevel } });
  }

  /* =====================================================
     FACET (ALL DATA IS ALREADY FILTERED)
  ===================================================== */
  pipeline.push({
    $facet: {
      data: [
        {
          $project: {
            _id: 0,
            applicationObjectId: '$application._id',
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

            completed: {
              $sum: {
                $cond: [
                  { $eq: ['$kyc.finalDecision', 'APPROVED'] },
                  1,
                  0,
                ],
              },
            },

            failed: {
              $sum: {
                $cond: [
                  { $eq: ['$kyc.finalDecision', 'REJECTED'] },
                  1,
                  0,
                ],
              },
            },

            inProgress: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      '$kyc.status',
                      ['LINK_SENT', 'IN_PROGRESS', 'PENDING'],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            lowRisk: {
              $sum: {
                $cond: [{ $eq: ['$riskSummary', 'Low Risk'] }, 1, 0],
              },
            },
          },
        },
      ],
    },
  });

  /* =====================================================
     EXECUTE
  ===================================================== */
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






}