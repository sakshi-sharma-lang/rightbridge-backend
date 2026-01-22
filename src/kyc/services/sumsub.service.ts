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
    try {
      if (!this.baseUrl || !this.appToken || !this.levelName) {
        throw new InternalServerErrorException('Sumsub config missing');
      }

      const ts = Math.floor(Date.now() / 1000);
      const url = `/resources/applicants?levelName=${this.levelName}`;

      const body: any = { externalUserId: userId };
      if (email) body.email = email;

      // ✅ FIX: body must be stringified for signature
      const signature = createSumsubSignature(
        'POST',
        url,
        ts,
        JSON.stringify(body),
      );

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
  const status = err?.response?.status;
  const data = err?.response?.data;

  console.log('SUMSUB ERROR:', data);

  // ✅ Applicant already exists
  if (status === 409) {
    return {
      applicantId: data?.description?.match(/[a-f0-9]{24}/)?.[0] || null,
      alreadyExists: true,
    };
  }

  // ✅ Invalid signature / token
  if (status === 401) {
    throw new InternalServerErrorException(
      'Sumsub authentication failed (invalid signature or token)',
    );
  }

  // ✅ Level not found
  if (status === 404) {
    throw new InternalServerErrorException(
      `Sumsub level not found: ${this.levelName}`,
    );
  }

  // ✅ Other errors
  throw new InternalServerErrorException(
    data?.description || 'Sumsub applicant creation failed',
  );
}
  }

  // ✅ supports userId OR applicantId
  async generateSdkToken(userIdOrApplicantId: string): Promise<string> {
    try {
      if (!this.levelName) {
        throw new InternalServerErrorException(
          'SUMSUB_LEVEL_NAME not configured',
        );
      }

      const ts = Math.floor(Date.now() / 1000);

      const path =
        `/resources/accessTokens?userId=${userIdOrApplicantId}` +
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
          'Content-Type': 'application/json', // ✅ added
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
    } catch (err: any) {
      throw new InternalServerErrorException(
        err?.message || 'Failed to generate SDK token',
      );
    }
  }
}
