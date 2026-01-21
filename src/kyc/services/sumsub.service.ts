import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import { createSumsubSignature } from '../utils/sumsub.util';
import * as https from 'https';
import { URL } from 'url';

@Injectable()
export class SumsubService {
  private readonly baseUrl = process.env.SUMSUB_BASE_URL!;
  private readonly appToken = process.env.SUMSUB_APP_TOKEN!.trim();
  private readonly levelName = process.env.SUMSUB_LEVEL_NAME!.trim();

  private buildHeaders(signature: string, ts: number) {
    return {
      'X-App-Token': this.appToken,
      'X-App-Access-Sig': signature,
      'X-App-Access-Ts': ts,
      'Content-Type': 'application/json',
    };
  }

  async createApplicant(userId: string, email?: string) {
  const ts = Math.floor(Date.now() / 1000);
  const url = `/resources/applicants?levelName=${this.levelName}`;

  const body: any = { externalUserId: userId };
  if (email) body.email = email;

  const signature = createSumsubSignature('POST', url, ts, body);

  try {
    const res = await axios.post(
      `${this.baseUrl}${url}`,
      body,
      { headers: this.buildHeaders(signature, ts) },
    );

    return {
      applicantId: res.data.id,
      levelName: this.levelName,
    };
  } catch (err: any) {
    throw new InternalServerErrorException(
      err?.response?.data || 'Sumsub applicant creation failed',
    );
  }
}


  // ✅ userId, NOT applicantId
 async generateSdkToken(userId: string): Promise<string> {
  if (!this.levelName) {
    throw new InternalServerErrorException(
      'SUMSUB_LEVEL_NAME not configured',
    );
  }

  const ts = Math.floor(Date.now() / 1000);

  const path =
    `/resources/accessTokens?userId=${userId}` +
    `&levelName=${this.levelName}` +
    `&ttlInSecs=600`;

  const signature = createSumsubSignature('POST', path, ts, '');

  const url = new URL(`${this.baseUrl}${path}`);

  const options: https.RequestOptions = {
    method: 'POST',
    hostname: url.hostname,
    path: url.pathname + url.search,
    headers: {
      'X-App-Token': this.appToken,
      'X-App-Access-Ts': ts,
      'X-App-Access-Sig': signature,
      'Content-Length': '0',
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(
            new InternalServerErrorException(
              data || 'Failed to generate Sumsub SDK token',
            ),
          );
        }

        try {
          const parsed = JSON.parse(data);
          resolve(parsed.token);
        } catch {
          reject(
            new InternalServerErrorException(
              'Invalid Sumsub SDK response',
            ),
          );
        }
      });
    });

    req.on('error', () =>
      reject(
        new InternalServerErrorException(
          'Sumsub SDK request failed',
        ),
      ),
    );

    req.end();
  });
}






}
