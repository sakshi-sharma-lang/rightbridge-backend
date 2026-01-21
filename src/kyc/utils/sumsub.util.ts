import * as crypto from 'crypto';

export function createSumsubSignature(
  method: string,
  path: string,
  ts: number,
  body?: any,
) {
  const secret = process.env.SUMSUB_SECRET_KEY!.trim();

  const bodyString =
    body && Object.keys(body).length
      ? JSON.stringify(body)
      : '';

  const stringToSign =
    `${ts}${method.toUpperCase()}${path}${bodyString}`;

  return crypto
    .createHmac('sha256', secret)
    .update(stringToSign)
    .digest('hex');
}
