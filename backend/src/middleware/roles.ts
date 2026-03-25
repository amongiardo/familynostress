import { Request, Response, NextFunction } from 'express';

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.activeFamilyRole !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

function canWrite(req: Request): boolean {
  if (!req.user) return false;
  if (req.activeFamilyRole === 'admin') return true;
  if (!req.activeFamilyPermissions) return false;
  return !req.activeFamilyPermissions.isReadOnly;
}

export function requirePlanningWrite(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (!canWrite(req)) return res.status(403).json({ error: 'Profilo in sola lettura' });
  if (req.activeFamilyRole === 'admin' || req.activeFamilyPermissions?.canManagePlanning) return next();
  return res.status(403).json({ error: 'Permesso pianificazione mancante' });
}

export function requireShoppingWrite(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (!canWrite(req)) return res.status(403).json({ error: 'Profilo in sola lettura' });
  if (req.activeFamilyRole === 'admin' || req.activeFamilyPermissions?.canManageShopping) return next();
  return res.status(403).json({ error: 'Permesso spesa mancante' });
}

export function requireChatWrite(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (!canWrite(req)) return res.status(403).json({ error: 'Profilo in sola lettura' });
  if (req.activeFamilyRole === 'admin' || req.activeFamilyPermissions?.canModerateChat) return next();
  return res.status(403).json({ error: 'Permesso chat mancante' });
}
