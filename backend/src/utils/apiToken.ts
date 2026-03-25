import crypto from 'crypto';

const TOKEN_PREFIX = 'fns_pat_';

export function generateApiTokenValue(): string {
  return `${TOKEN_PREFIX}${crypto.randomBytes(24).toString('hex')}`;
}

export function hashApiTokenValue(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
