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
  riskLevel?: string; // Low Risk | Medium Risk | High Risk | Pending
  applicantName?: string;
  applicationId?: string;
  fromDate?: string;
  toDate?: string;
}) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const skip = (page - 1) * limit;

  const kycMatch: any = {};

  // 🔹 Status filter
  if (query.status) {
    kycMatch.status = query.status;
  }

  // 🔹 Date filter
  if (query.fromDate || query.toDate) {
    kycMatch.createdAt = {};
    if (query.fromDate) kycMatch.createdAt.$gte = new Date(query.fromDate);
    if (query.toDate) kycMatch.createdAt.$lte = new Date(query.toDate);
  }

  const [result] = await this.kycModel.aggregate([
    // 🔹 Base filter
    { $match: kycMatch },

    // 🔹 Latest first
    { $sort: { createdAt: -1 } },

    // 🔹 One latest KYC per applicant
    {
      $group: {
        _id: '$externalUserId',
        kyc: { $first: '$$ROOT' },
      },
    },

    // 🔹 Join application
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
    { $unwind: '$application' },

    // 🔹 Filter by applicationId
    ...(query.applicationId
      ? [{ $match: { 'application.appId': query.applicationId } }]
      : []),

    // 🔹 Resolve applicant
    {
      $addFields: {
        applicant: {
          $arrayElemAt: [
            {
              $filter: {
                input: '$application.applicants',
                as: 'a',
                cond: { $eq: ['$$a.externalUserId', '$kyc.externalUserId'] },
              },
            },
            0,
          ],
        },
      },
    },

    // 🔹 Applicant name search
    ...(query.applicantName
      ? [
          {
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
          },
        ]
      : []),

    // 🔹 Normalize risk summary
    {
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
    },

    // 🔹 Risk level filter (NOW WORKS ✅)
    ...(query.riskLevel
      ? [{ $match: { riskSummary: query.riskLevel } }]
      : []),

    // 🔹 Final output
    {
      $facet: {
        // ================= TABLE =================
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

        // ================= TOTAL =================
        total: [{ $count: 'count' }],

        // ================= CARDS =================
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
    },
  ]);

  return {
    success: true,
    cards: result?.cards?.[0] || {
      totalChecks: 0,
      completed: 0,
      inProgress: 0,
      failed: 0,
      lowRisk: 0,
    },
    data: result?.data || [],
    total: result?.total?.[0]?.count || 0,
    page,
    limit,
  };
}




}