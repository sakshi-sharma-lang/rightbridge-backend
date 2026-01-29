import crypto from 'crypto';

export function createSumsubSignature(
  ts: number,
  method: string,
  path: string,
  body: any = ''
) {
  const secretKey = process.env.SUMSUB_SECRET_KEY?.trim();

  if (!secretKey) {
    throw new Error('SUMSUB_SECRET_KEY is missing');
  }

  const normalizedMethod = method.toUpperCase();
  const normalizedBody =
    typeof body === 'string' ? body : JSON.stringify(body || '');

  const message = ts + normalizedMethod + path + normalizedBody;

  return crypto
    .createHmac('sha256', secretKey)
    .update(message)
    .digest('hex');
}
