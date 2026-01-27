import * as crypto from 'crypto';

export function createSumsubSignature(
  method: string,
  path: string,
  ts: number,
  body?: any,
) {
  const secret = process.env.SUMSUB_SECRET_KEY!.trim();

  let bodyString = '';

  // ✅ SAFE handling (no double stringify)
  if (body) {
    bodyString = typeof body === 'string' ? body : JSON.stringify(body);
  }

  // ✅ EXACT Sumsub format
  const stringToSign = ts + method.toUpperCase() + path + bodyString;

  return crypto
    .createHmac('sha256', secret)
    .update(stringToSign)
    .digest('hex');
}
