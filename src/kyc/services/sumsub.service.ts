import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import https from 'https';

@Injectable()
export class SumsubService {
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
    const query = `ttlInSecs=3600&userId=${externalUserId}&levelName=${this.levelName}`;
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



}
