import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { hashApiTokenValue } from '../utils/apiToken';
import { findApiTokenByHash, touchApiTokenLastUsed } from '../services/apiTokens';

function getBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header) return undefined;

  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return undefined;
  return token.trim();
}

export async function authenticateRequest(req: Request): Promise<boolean> {
  if (typeof req.isAuthenticated === 'function' && req.isAuthenticated() && req.user) {
    req.authMethod = 'session';
    req.apiTokenId = undefined;
    return true;
  }

  const bearerToken = getBearerToken(req);
  if (!bearerToken) {
    return false;
  }

  const tokenRecord = await findApiTokenByHash(hashApiTokenValue(bearerToken));

  if (!tokenRecord || tokenRecord.revokedAt || (tokenRecord.expiresAt && tokenRecord.expiresAt <= new Date())) {
    return false;
  }

  const user = await prisma.user.findUnique({ where: { id: tokenRecord.userId } });
  if (!user) {
    return false;
  }

  req.user = user;
  req.authMethod = 'api_token';
  req.apiTokenId = tokenRecord.id;

  await touchApiTokenLastUsed(tokenRecord.id);

  return true;
}

async function resolveActiveFamily(req: Request) {
  if (!req.user) return null;
  req.activeFamilyId = undefined;
  req.activeFamilyRole = undefined;
  req.activeFamilyPermissions = undefined;

  const requestedFamilyId =
    typeof req.headers['x-family-id'] === 'string'
      ? req.headers['x-family-id']
      : Array.isArray(req.headers['x-family-id'])
        ? req.headers['x-family-id'][0]
        : undefined;

  if (requestedFamilyId) {
    if (req.authMethod === 'session') {
      req.session.activeFamilyId = requestedFamilyId;
    }
  }

  const sessionFamilyId = req.authMethod === 'session' ? req.session.activeFamilyId : undefined;
  const targetFamilyId = requestedFamilyId || sessionFamilyId;

  if (targetFamilyId) {
    const membership = await prisma.familyMember.findUnique({
      where: {
        familyId_userId: {
          familyId: targetFamilyId,
          userId: req.user.id,
        },
      },
      select: {
        familyId: true,
        role: true,
        status: true,
        canManagePlanning: true,
        canManageShopping: true,
        canModerateChat: true,
        isReadOnly: true,
        family: {
          select: {
            deletedAt: true,
          },
        },
      },
    });

    if (membership && membership.status === 'active' && !membership.family.deletedAt) {
      if (req.authMethod === 'session') {
        req.session.activeFamilyId = membership.familyId;
      }
      req.activeFamilyId = membership.familyId;
      req.activeFamilyRole = membership.role;
      req.activeFamilyPermissions = {
        canManagePlanning: membership.canManagePlanning,
        canManageShopping: membership.canManageShopping,
        canModerateChat: membership.canModerateChat,
        isReadOnly: membership.isReadOnly,
      };
      return membership;
    }
  }

  const fallback = await prisma.familyMember.findFirst({
    where: { userId: req.user.id, status: 'active', family: { deletedAt: null } },
    orderBy: [{ createdAt: 'asc' }, { familyId: 'asc' }],
    select: {
      familyId: true,
      role: true,
      canManagePlanning: true,
      canManageShopping: true,
      canModerateChat: true,
      isReadOnly: true,
    },
  });

  if (!fallback) {
    if (req.authMethod === 'session') {
      req.session.activeFamilyId = undefined;
    }
    return null;
  }

  if (req.authMethod === 'session') {
    req.session.activeFamilyId = fallback.familyId;
  }
  req.activeFamilyId = fallback.familyId;
  req.activeFamilyRole = fallback.role;
  req.activeFamilyPermissions = {
    canManagePlanning: fallback.canManagePlanning,
    canManageShopping: fallback.canManageShopping,
    canModerateChat: fallback.canModerateChat,
    isReadOnly: fallback.isReadOnly,
  };
  return fallback;
}

export async function isLoggedIn(req: Request, res: Response, next: NextFunction) {
  if (!(await authenticateRequest(req))) {
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
    if (!(await authenticateRequest(req))) {
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
