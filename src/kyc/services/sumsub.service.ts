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

  // ================= SIGNATURE =================
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

      console.log('\n================ CREATE APPLICANT =================');
      console.log('EXTERNAL USER ID:', externalUserId);
      console.log('EMAIL:', email);
      console.log('LEVEL NAME:', this.levelName);
      console.log('BASE URL:', this.baseUrl);

      const ts = Math.floor(Date.now() / 1000);
      const path = `/resources/applicants?levelName=${this.levelName}`;

      const bodyObj: any = { externalUserId };
      if (email) bodyObj.email = email;

      const body = JSON.stringify(bodyObj);
      const signature = this.createSignature('POST', path, ts, body);

      console.log('PATH:', path);
      console.log('BODY:', body);
      console.log('SIGNATURE:', signature);
      console.log('TIMESTAMP:', ts);

      const res = await axios.post(this.baseUrl + path, body, {
        headers: this.getHeaders(signature, ts),
      });

      console.log('✅ APPLICANT CREATED SUCCESSFULLY:', res.data);

      return {
        applicantId: res.data.id,
        levelName: this.levelName,
      };
    } catch (err: any) {
      console.error('\n❌ CREATE APPLICANT ERROR =================');
      console.error('STATUS:', err?.response?.status);
      console.error('DATA:', err?.response?.data);
      console.error('MESSAGE:', err?.message);

      const data = err?.response?.data;

      // ✅ If applicant already exists → fetch applicant by externalUserId
      if (err?.response?.status === 409) {
        console.log('⚠️ Applicant already exists. Fetching from Sumsub...');

        const applicant = await this.getApplicantByExternalUserId(externalUserId);

             let applicantId =
        applicant?.id ||
        applicant?.list?.items?.[0]?.id || // ✅ Sumsub list response
        null;

      if (!applicantId) {
        console.error('❌ Applicant exists but cannot be fetched!');
        console.error('FULL RESPONSE:', JSON.stringify(applicant, null, 2));
        throw new InternalServerErrorException('Failed to fetch existing applicant');
      }

      console.log('✅ EXISTING APPLICANT ID FOUND:', applicantId);

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

  // ================= GET APPLICANT BY EXTERNAL USER ID =================
  async getApplicantByExternalUserId(externalUserId: string) {
    try {
      externalUserId = externalUserId.trim();

      const ts = Math.floor(Date.now() / 1000);
      const encodedId = encodeURIComponent(externalUserId);

      const path = `/resources/applicants/-;externalUserId=${encodedId}`;
      const signature = this.createSignature('GET', path, ts, '');

      console.log('\n================ GET APPLICANT =================');
      console.log('EXTERNAL USER ID:', externalUserId);
      console.log('ENCODED ID:', encodedId);
      console.log('PATH:', path);
      console.log('SIGNATURE:', signature);
      console.log('TIMESTAMP:', ts);
      console.log('URL:', this.baseUrl + path);

      const res = await axios.get(this.baseUrl + path, {
        headers: this.getHeaders(signature, ts),
      });

      console.log('✅ APPLICANT FETCHED:', res.data);

      return res.data;
    } catch (err: any) {
      console.error('\n❌ GET APPLICANT ERROR =================');
      console.error('STATUS:', err?.response?.status);
      console.error('DATA:', err?.response?.data);
      console.error('MESSAGE:', err?.message);
      console.error('EXTERNAL USER ID:', externalUserId);

      return null;
    }
  }

  // ================= GENERATE SDK TOKEN (CORRECT WAY) =================
  async generateSdkToken(applicantId: string): Promise<string> {
    try {
      applicantId = applicantId.trim();

      const ts = Math.floor(Date.now() / 1000);
      const query = `ttlInSecs=600&userId=${applicantId}&levelName=${this.levelName}`;
      const path = `/resources/accessTokens?${query}`;
      const signature = this.createSignature('POST', path, ts, '');

      const url = this.baseUrl + path;

      console.log('\n================ GENERATE SDK TOKEN =================');
      console.log('APPLICANT ID:', applicantId);
      console.log('PATH:', path);
      console.log('URL:', url);
      console.log('SIGNATURE:', signature);
      console.log('TIMESTAMP:', ts);

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
              console.log('SUMSUB RESPONSE STATUS:', res.statusCode);
              console.log('SUMSUB RESPONSE BODY:', data);

              try {
                const json = JSON.parse(data);

                if (!json.token) {
                  return reject(json);
                }

                resolve(json.token);
              } catch (e) {
                reject(data);
              }
            });
          },
        );

        req.on('error', (err) => {
          console.error('HTTPS ERROR:', err);
          reject(err);
        });

        req.end();
      });
    } catch (err: any) {
      console.error('\n❌ SDK TOKEN ERROR =================');
      console.error(err);

      throw new InternalServerErrorException(
        err?.description || err?.message || 'Failed to generate SDK token',
      );
    }
  }
}
