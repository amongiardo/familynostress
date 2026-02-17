import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';

async function resolveActiveFamily(req: Request) {
  if (!req.user) return null;
  req.activeFamilyId = undefined;
  req.activeFamilyRole = undefined;

  const requestedFamilyId =
    typeof req.headers['x-family-id'] === 'string'
      ? req.headers['x-family-id']
      : Array.isArray(req.headers['x-family-id'])
        ? req.headers['x-family-id'][0]
        : undefined;

  if (requestedFamilyId) {
    (req.session as any).activeFamilyId = requestedFamilyId;
  }

  const sessionFamilyId = (req.session as any)?.activeFamilyId as string | undefined;

  if (sessionFamilyId) {
    const membership = await prisma.familyMember.findUnique({
      where: {
        familyId_userId: {
          familyId: sessionFamilyId,
          userId: req.user.id,
        },
      },
      select: {
        familyId: true,
        role: true,
        status: true,
        family: {
          select: {
            deletedAt: true,
          },
        },
      },
    });

    if (membership && membership.status === 'active' && !membership.family.deletedAt) {
      (req.session as any).activeFamilyId = membership.familyId;
      req.activeFamilyId = membership.familyId;
      req.activeFamilyRole = membership.role;
      return membership;
    }
  }

  const fallback = await prisma.familyMember.findFirst({
    where: { userId: req.user.id, status: 'active', family: { deletedAt: null } },
    orderBy: [{ createdAt: 'asc' }, { familyId: 'asc' }],
    select: {
      familyId: true,
      role: true,
    },
  });

  if (!fallback) {
    (req.session as any).activeFamilyId = undefined;
    return null;
  }

  (req.session as any).activeFamilyId = fallback.familyId;
  req.activeFamilyId = fallback.familyId;
  req.activeFamilyRole = fallback.role;
  return fallback;
}

export async function isLoggedIn(req: Request, res: Response, next: NextFunction) {
  if (typeof req.isAuthenticated !== 'function') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await resolveActiveFamily(req);
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  try {
    if (typeof req.isAuthenticated !== 'function') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    await resolveActiveFamily(req);
    if (!req.activeFamilyId) {
      return res.status(403).json({ error: 'No active family membership' });
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

export function getFamilyId(req: Request): string {
  if (!req.activeFamilyId) {
    throw new Error('Active family not resolved');
  }
  return req.activeFamilyId;
}

export function getFamilyRole(req: Request): 'admin' | 'member' {
  if (!req.activeFamilyRole) {
    throw new Error('Active family role not resolved');
  }
  return req.activeFamilyRole;
}
