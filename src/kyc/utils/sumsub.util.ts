import * as crypto from 'crypto';

export function createSumsubSignature(
  method: string,
  path: string,
  ts: number,
  body: string = '',
) {
  const secretKey = process.env.SUMSUB_SECRET_KEY;

  if (!secretKey) {
    throw new Error('SUMSUB_SECRET_KEY is missing in environment variables');
  }

  const payload = ts + method.toUpperCase() + path + body;

  return crypto
    .createHmac('sha256', secretKey) // ❗ do NOT trim secret key
    .update(payload, 'utf8')
    .digest('hex');
}
