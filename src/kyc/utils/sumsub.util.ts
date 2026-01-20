import * as crypto from 'crypto';

export function createSumsubSignature(
  method: string,
  url: string,
  timestamp: number,
  body: string = '',
): string {
  const payload = `${timestamp}${method}${url}${body}`;

  return crypto
    .createHmac('sha256', process.env.SUMSUB_SECRET_KEY as string)
    .update(payload)
    .digest('hex');
}
