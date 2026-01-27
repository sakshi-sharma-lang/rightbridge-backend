import * as crypto from 'crypto';

export function createSumsubSignature(
  method: string,
  path: string,
  ts: number,
  body: string = '',
) {
  const secretKey = process.env.SUMSUB_SECRET_KEY!.trim();

  const payload = ts + method.toUpperCase() + path + body;

  return crypto
    .createHmac('sha256', secretKey)
    .update(payload)
    .digest('hex');
}
