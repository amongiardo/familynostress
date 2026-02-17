import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { generateFamilyAuthCode, isValidFamilyAuthCode } from '../utils/familyAuthCode';

export function readProvidedCode(req: Request): string | null {
  const userHeaderCode =
    typeof req.headers['x-user-auth-code'] === 'string'
      ? req.headers['x-user-auth-code']
      : Array.isArray(req.headers['x-user-auth-code'])
        ? req.headers['x-user-auth-code'][0]
        : null;

  const headerCode =
    typeof req.headers['x-family-auth-code'] === 'string'
      ? req.headers['x-family-auth-code']
      : Array.isArray(req.headers['x-family-auth-code'])
        ? req.headers['x-family-auth-code'][0]
        : null;

  const bodyCode = (req.body as any)?.authCode;
  const queryCode = (req.query as any)?.authCode;

  const raw = userHeaderCode ?? headerCode ?? bodyCode ?? queryCode;
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toUpperCase();
  return normalized || null;
}

export async function ensureUserAuthCode(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { authCode: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (user.authCode) {
    return user.authCode;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { authCode: generateFamilyAuthCode(5) },
    select: { authCode: true },
  });

  return updated.authCode!;
}

export async function requireFamilyAuthCode(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const provided = readProvidedCode(req);
    if (!provided) {
      return res.status(400).json({ error: 'Codice di autenticazione richiesto' });
    }
    if (!isValidFamilyAuthCode(provided)) {
      return res.status(400).json({ error: 'Codice di autenticazione non valido' });
    }

    const userAuthCode = await ensureUserAuthCode(userId);
    if (userAuthCode.toUpperCase() !== provided) {
      return res.status(403).json({ error: 'Codice di autenticazione errato' });
    }

    next();
  } catch (error) {
    next(error);
  }
}
