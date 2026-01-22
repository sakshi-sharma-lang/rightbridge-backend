import * as crypto from 'crypto';

export function createSumsubSignature(
  method: string,
  path: string,
  ts: number,
  body?: any,
) {
  const secret = process.env.SUMSUB_SECRET_KEY!.trim();

  let bodyString = '';

  // ✅ FIX: handle string and object correctly
  if (body) {
    if (typeof body === 'string') {
      bodyString = body;
    } else {
      bodyString = JSON.stringify(body);
    }
  }

  // ✅ EXACT Sumsub format
  const stringToSign = ts + method.toUpperCase() + path + bodyString;

  return crypto
    .createHmac('sha256', secret)
    .update(stringToSign)
    .digest('hex');
}
