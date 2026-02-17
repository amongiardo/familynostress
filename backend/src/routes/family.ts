import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { addDays } from 'date-fns';
import prisma from '../prisma';
import { isAuthenticated, isLoggedIn, getFamilyId, getFamilyRole } from '../middleware/auth';
import { requireAdmin } from '../middleware/roles';
import { ensureUserAuthCode, readProvidedCode, requireFamilyAuthCode } from '../middleware/familyAuthCode';
import { generateFamilyAuthCode, isValidFamilyAuthCode } from '../utils/familyAuthCode';
import { createNotifications } from '../services/notifications';

const router = Router();

type FamilyRole = 'admin' | 'member';
type CitySelectionInput = {
  name: string;
  displayName?: string;
  country?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
};

type InviteValidationResult =
  | { ok: true; invite: any }
  | { ok: false; error: string; status: number };

function toFamilyResponse(family: any, role: FamilyRole, authCode?: string) {
  return {
    id: family.id,
    name: family.name,
    city: family.city,
    rotationWindowDays: family.rotationWindowDays,
    maxWeeklyDishRepeat: family.maxWeeklyDishRepeat,
    eventModeEnabled: family.eventModeEnabled,
    eventModeTitle: family.eventModeTitle,
    eventModeStart: family.eventModeStart,
    eventModeEnd: family.eventModeEnd,
    cityDisplayName: family.cityDisplayName,
    cityCountry: family.cityCountry,
    cityTimezone: family.cityTimezone,
    cityLatitude: family.cityLatitude,
    cityLongitude: family.cityLongitude,
    authCode,
    createdAt: family.createdAt,
    users: (family.memberships || []).map((membership: any) => ({
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      avatarUrl: membership.user.avatarUrl,
      role: membership.role,
      canManagePlanning: membership.canManagePlanning,
      canManageShopping: membership.canManageShopping,
      canModerateChat: membership.canModerateChat,
      isReadOnly: membership.isReadOnly,
    })),
    role,
  };
}

const ACTIVE_FAMILY_FILTER = { deletedAt: null };
const BACKUP_TARGETS = ['planning', 'chats', 'dishes', 'shopping', 'invites', 'notifications'] as const;
type BackupTarget = (typeof BACKUP_TARGETS)[number];

function sanitizeBackupTargets(input: unknown): BackupTarget[] {
  if (!Array.isArray(input)) return [];
  const uniq = new Set<BackupTarget>();
  for (const value of input) {
    if (typeof value === 'string' && (BACKUP_TARGETS as readonly string[]).includes(value)) {
      uniq.add(value as BackupTarget);
    }
  }
  return Array.from(uniq);
}

function normalizeCitySelection(input: unknown): CitySelectionInput | null {
  if (!input || typeof input !== 'object') return null;

  const payload = input as Record<string, unknown>;
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (!name) return null;

  const latitudeRaw = payload.latitude;
  const longitudeRaw = payload.longitude;
  const latitude = typeof latitudeRaw === 'number' ? latitudeRaw : Number(latitudeRaw);
  const longitude = typeof longitudeRaw === 'number' ? longitudeRaw : Number(longitudeRaw);

  return {
    name,
    displayName: typeof payload.displayName === 'string' ? payload.displayName.trim() : undefined,
    country: typeof payload.country === 'string' ? payload.country.trim() : undefined,
    timezone: typeof payload.timezone === 'string' ? payload.timezone.trim() : undefined,
    latitude: Number.isFinite(latitude) ? latitude : undefined,
    longitude: Number.isFinite(longitude) ? longitude : undefined,
  };
}

async function ensureInviteValid(token: string): Promise<InviteValidationResult> {
  const invite = await prisma.familyInvite.findUnique({
    where: { token },
    include: {
      family: {
        select: {
          id: true,
          name: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!invite) return { ok: false, error: 'Invite not found', status: 404 };
  if (invite.usedAt) return { ok: false, error: 'Invite already used', status: 400 };
  if (invite.expiresAt < new Date()) return { ok: false, error: 'Invite expired', status: 400 };
  if (invite.family.deletedAt) return { ok: false, error: 'Family no longer available', status: 410 };

  return { ok: true, invite };
}

// Get active family
router.get('/', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const role = getFamilyRole(req);
    const userAuthCode = await ensureUserAuthCode(req.user!.id);

    const family = await prisma.family.findFirst({
      where: { id: familyId, ...ACTIVE_FAMILY_FILTER },
      include: {
        memberships: {
          where: { status: 'active' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!family) {
      return res.status(404).json({ error: 'Family not found' });
    }

    res.json(toFamilyResponse(family, role, userAuthCode));
  } catch (error) {
    next(error);
  }
});

// List active/former families for current user
router.get('/mine', isLoggedIn, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const activeFamilyId = req.activeFamilyId || null;

    const memberships = await prisma.familyMember.findMany({
      where: { userId },
      include: {
        family: {
          select: {
            id: true,
            name: true,
            city: true,
            createdAt: true,
            deletedAt: true,
            createdByUser: {
              select: {
                name: true,
                email: true,
              },
            },
            deletedByUser: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { familyId: 'asc' }],
    });

    const familyIds = Array.from(new Set(memberships.map((m) => m.familyId)));
    const activeCounts = familyIds.length
      ? await prisma.familyMember.groupBy({
          by: ['familyId'],
          where: { familyId: { in: familyIds }, status: 'active' },
          _count: { _all: true },
        })
      : [];
    const countMap = new Map(activeCounts.map((c) => [c.familyId, c._count._all]));

    const activeFamilies = memberships
      .filter((m) => m.status === 'active' && !m.family.deletedAt)
      .map((m) => ({
        id: m.family.id,
        name: m.family.name,
        city: m.family.city,
        createdAt: m.family.createdAt,
        role: m.role,
        membersCount: countMap.get(m.family.id) || 0,
        status: 'active' as const,
      }));

    const formerFamilies = memberships
      .filter((m) => m.status === 'left' || m.status === 'removed' || Boolean(m.family.deletedAt))
      .map((m) => ({
        id: m.family.id,
        name: m.family.name,
        city: m.family.city,
        createdAt: m.family.createdAt,
        role: m.role,
        membersCount: !m.family.deletedAt ? countMap.get(m.family.id) || 0 : 0,
        status: m.status as 'left' | 'removed',
        leftAt: m.leftAt,
        removedAt: m.removedAt,
        familyDeletedAt: m.family.deletedAt,
        creatorName: m.family.createdByUser?.name || null,
        creatorEmail: m.family.createdByUser?.email || null,
        deletedByName: m.family.deletedByUser?.name || null,
        deletedByEmail: m.family.deletedByUser?.email || null,
        canRejoin: m.status === 'left' && !m.family.deletedAt,
        isEliminated: m.status === 'removed' || Boolean(m.family.deletedAt),
      }));

    res.json({ activeFamilyId, families: activeFamilies, formerFamilies });
  } catch (error) {
    next(error);
  }
});

// Switch active family in session
router.post('/switch', isLoggedIn, async (req, res, next) => {
  try {
    const { familyId } = req.body ?? {};
    if (!familyId || typeof familyId !== 'string') {
      return res.status(400).json({ error: 'Family ID is required' });
    }

    const membership = await prisma.familyMember.findUnique({
      where: {
        familyId_userId: {
          familyId,
          userId: req.user!.id,
        },
      },
      select: {
        familyId: true,
        status: true,
        family: {
          select: {
            deletedAt: true,
          },
        },
      },
    });

    if (!membership || membership.status !== 'active' || membership.family.deletedAt) {
      return res.status(403).json({ error: 'Not an active member of selected family' });
    }

    req.session.activeFamilyId = familyId;
    res.json({ success: true, activeFamilyId: familyId });
  } catch (error) {
    next(error);
  }
});

// Create a new family and join as admin
router.post('/create', isLoggedIn, async (req, res, next) => {
  try {
    const { name, city, citySelection, switchToNewFamily } = req.body ?? {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Family name is required' });
    }

    const normalizedCitySelection = normalizeCitySelection(citySelection);
    const normalizedCity =
      normalizedCitySelection?.name ||
      (typeof city === 'string' && city.trim() ? city.trim() : 'Roma');

    const family = await prisma.family.create({
      data: {
        name: name.trim(),
        city: normalizedCity,
        cityDisplayName: normalizedCitySelection?.displayName,
        cityCountry: normalizedCitySelection?.country,
        cityTimezone: normalizedCitySelection?.timezone,
        cityLatitude: normalizedCitySelection?.latitude,
        cityLongitude: normalizedCitySelection?.longitude,
        createdByUserId: req.user!.id,
      },
    });

    await prisma.familyMember.create({
      data: {
        familyId: family.id,
        userId: req.user!.id,
        role: 'admin',
        status: 'active',
      },
    });

    const shouldSwitch = switchToNewFamily !== false;
    if (shouldSwitch) {
      req.session.activeFamilyId = family.id;
    }

    res.status(201).json({
      family: {
        id: family.id,
        name: family.name,
        city: family.city,
        cityDisplayName: family.cityDisplayName,
        cityCountry: family.cityCountry,
        cityTimezone: family.cityTimezone,
        cityLatitude: family.cityLatitude,
        cityLongitude: family.cityLongitude,
        createdAt: family.createdAt,
        role: 'admin',
      },
      activeFamilyId: shouldSwitch ? family.id : req.session.activeFamilyId,
    });
  } catch (error) {
    next(error);
  }
});

// Leave family (only non-admin)
router.post('/:familyId/leave', isLoggedIn, async (req, res, next) => {
  try {
    const { familyId } = req.params;
    const userId = req.user!.id;
    const { targetFamilyId } = (req.body ?? {}) as { targetFamilyId?: string };
    const isLeavingActiveFamily = req.session.activeFamilyId === familyId;

    const membership = await prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId, userId } },
      select: {
        role: true,
        status: true,
        family: {
          select: {
            deletedAt: true,
          },
        },
      },
    });

    if (!membership || membership.status !== 'active') {
      return res.status(404).json({ error: 'Active membership not found' });
    }
    if (membership.family.deletedAt) {
      return res.status(400).json({ error: 'La famiglia risulta gia cancellata' });
    }

    if (membership.role === 'admin') {
      return res.status(400).json({ error: 'Gli admin non possono abbandonare la famiglia da questa azione' });
    }

    const activeFamiliesCount = await prisma.familyMember.count({
      where: {
        userId,
        status: 'active',
        family: { deletedAt: null },
      },
    });
    if (activeFamiliesCount <= 1) {
      return res.status(400).json({ error: 'Non puoi abbandonare l’unica famiglia di cui fai parte' });
    }

    if (isLeavingActiveFamily) {
      if (!targetFamilyId || typeof targetFamilyId !== 'string') {
        return res.status(400).json({ error: 'Seleziona la famiglia di destinazione prima di abbandonare quella attiva' });
      }

      if (targetFamilyId === familyId) {
        return res.status(400).json({ error: 'La famiglia di destinazione deve essere diversa da quella da abbandonare' });
      }

      const targetMembership = await prisma.familyMember.findUnique({
        where: { familyId_userId: { familyId: targetFamilyId, userId } },
        select: {
          status: true,
          family: {
            select: {
              deletedAt: true,
            },
          },
        },
      });

      if (targetMembership?.status !== 'active' || targetMembership.family.deletedAt) {
        return res.status(400).json({ error: 'La famiglia di destinazione non è valida' });
      }
    }

    await prisma.familyMember.update({
      where: { familyId_userId: { familyId, userId } },
      data: { status: 'left', leftAt: new Date() },
    });

    await prisma.chatMessage.create({
      data: {
        familyId,
        messageType: 'system',
        content: `${req.user!.name} ha abbandonato la famiglia.`,
      },
    });

    const recipients = await prisma.familyMember.findMany({
      where: {
        familyId,
        status: 'active',
        userId: { not: userId },
      },
      select: { userId: true },
    });

    await createNotifications(
      recipients.map((recipient) => ({
        userId: recipient.userId,
        familyId,
        type: 'member_left',
        title: 'Membro uscito',
        message: `${req.user!.name} ha abbandonato la famiglia.`,
      }))
    );

    if (isLeavingActiveFamily && targetFamilyId) {
      req.session.activeFamilyId = targetFamilyId;
    }

    res.json({ success: true, activeFamilyId: req.session.activeFamilyId || null });
  } catch (error) {
    next(error);
  }
});

// Rejoin a former family
router.post('/:familyId/rejoin', isLoggedIn, async (req, res, next) => {
  try {
    const { familyId } = req.params;
    const userId = req.user!.id;

    const membership = await prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId, userId } },
      select: {
        status: true,
        family: {
          select: {
            deletedAt: true,
          },
        },
      },
    });

    if (!membership) {
      return res.status(404).json({ error: 'Former membership not found' });
    }
    if (membership.status === 'removed') {
      return res.status(400).json({ error: 'Rientro non consentito: devi essere invitato nuovamente' });
    }
    if (membership.status !== 'left') {
      return res.status(404).json({ error: 'Former membership not found' });
    }
    if (membership.family.deletedAt) {
      return res.status(400).json({ error: 'La famiglia e stata eliminata e non e possibile rientrare' });
    }

    await prisma.familyMember.update({
      where: { familyId_userId: { familyId, userId } },
      data: { status: 'active', leftAt: null, removedAt: null },
    });

    req.session.activeFamilyId = familyId;
    res.json({ success: true, activeFamilyId: familyId });
  } catch (error) {
    next(error);
  }
});

// Permanently mark a former family membership as removed (no direct rejoin)
router.delete('/:familyId/former-membership', isLoggedIn, async (req, res, next) => {
  try {
    const { familyId } = req.params;
    const userId = req.user!.id;

    const membership = await prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId, userId } },
      select: { status: true },
    });

    if (!membership || (membership.status !== 'left' && membership.status !== 'removed')) {
      return res.status(404).json({ error: 'Former membership not found' });
    }

    await prisma.familyMember.update({
      where: { familyId_userId: { familyId, userId } },
      data: {
        status: 'removed',
        removedAt: new Date(),
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Delete entire family (admin only, requires auth code)
router.delete('/:familyId', isLoggedIn, async (req, res, next) => {
  try {
    const { familyId } = req.params;
    const userId = req.user!.id;
    const { targetFamilyId } = (req.body ?? {}) as { targetFamilyId?: string };
    const isDeletingActiveFamily = req.session.activeFamilyId === familyId;

    const membership = await prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId, userId } },
      select: {
        role: true,
        status: true,
        family: {
          select: {
            deletedAt: true,
          },
        },
      },
    });

    if (!membership || membership.status !== 'active') {
      return res.status(403).json({ error: 'Not an active member of this family' });
    }
    if (membership.family.deletedAt) {
      return res.status(404).json({ error: 'Family not found' });
    }

    if (membership.role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can delete the family' });
    }

    // Check if this is the only family
    const activeFamiliesCount = await prisma.familyMember.count({
      where: { userId, status: 'active', family: ACTIVE_FAMILY_FILTER },
    });
    if (activeFamiliesCount <= 1) {
      return res.status(400).json({ error: 'Non puoi eliminare l\'unica famiglia di cui fai parte' });
    }

    if (isDeletingActiveFamily) {
      if (!targetFamilyId || typeof targetFamilyId !== 'string') {
        return res.status(400).json({ error: 'Seleziona la famiglia di destinazione prima di eliminare quella attiva' });
      }

      if (targetFamilyId === familyId) {
        return res.status(400).json({ error: 'La famiglia di destinazione deve essere diversa da quella da eliminare' });
      }

      const targetMembership = await prisma.familyMember.findUnique({
        where: { familyId_userId: { familyId: targetFamilyId, userId } },
        select: {
          status: true,
          family: {
            select: {
              deletedAt: true,
            },
          },
        },
      });

      if (targetMembership?.status !== 'active' || targetMembership.family.deletedAt) {
        return res.status(400).json({ error: 'La famiglia di destinazione non è valida' });
      }
    }

    const code = readProvidedCode(req);
    if (!code) {
      return res.status(400).json({ error: 'Codice di autenticazione richiesto' });
    }
    if (!isValidFamilyAuthCode(code)) {
      return res.status(400).json({ error: 'Codice di autenticazione non valido' });
    }

    const familyExists = await prisma.family.findFirst({
      where: { id: familyId, deletedAt: null },
      select: { id: true, deletedAt: true },
    });
    if (!familyExists) {
      return res.status(404).json({ error: 'Family not found' });
    }

    const userAuthCode = await ensureUserAuthCode(userId);
    if (userAuthCode.toUpperCase() !== code) {
      return res.status(403).json({ error: 'Codice di autenticazione errato' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.family.update({
        where: { id: familyId },
        data: {
          deletedAt: new Date(),
          deletedByUserId: userId,
        },
      });

      await tx.familyMember.updateMany({
        where: {
          familyId,
          status: 'active',
        },
        data: {
          status: 'left',
          leftAt: new Date(),
        },
      });
    });

    const recipients = await prisma.familyMember.findMany({
      where: {
        familyId,
        userId: { not: userId },
      },
      select: { userId: true },
    });

    await createNotifications(
      recipients.map((recipient) => ({
        userId: recipient.userId,
        familyId,
        type: 'family_deleted',
        title: 'Famiglia eliminata',
        message: 'Una famiglia di cui facevi parte è stata eliminata.',
      }))
    );

    if (isDeletingActiveFamily && targetFamilyId) {
      req.session.activeFamilyId = targetFamilyId;
    } else if (req.session.activeFamilyId === familyId) {
      req.session.activeFamilyId = undefined;
    }

    res.json({ success: true, activeFamilyId: req.session.activeFamilyId || null });
  } catch (error) {
    next(error);
  }
});

// Update active family name / city
router.put('/', isAuthenticated, requireAdmin, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { name, city, citySelection } = req.body;

    if ((!name || typeof name !== 'string') && (!city || typeof city !== 'string')) {
      if (!citySelection || typeof citySelection !== 'object') {
        return res.status(400).json({ error: 'Name or city is required' });
      }
    }

    const normalizedCitySelection = normalizeCitySelection(citySelection);

    const family = await prisma.family.update({
      where: { id: familyId },
      data: {
        ...(name && typeof name === 'string' ? { name: name.trim() } : {}),
        ...(normalizedCitySelection
          ? {
              city: normalizedCitySelection.name,
              cityDisplayName: normalizedCitySelection.displayName,
              cityCountry: normalizedCitySelection.country,
              cityTimezone: normalizedCitySelection.timezone,
              cityLatitude: normalizedCitySelection.latitude,
              cityLongitude: normalizedCitySelection.longitude,
            }
          : city && typeof city === 'string'
            ? {
                city: city.trim(),
                cityDisplayName: null,
                cityCountry: null,
                cityTimezone: null,
                cityLatitude: null,
                cityLongitude: null,
              }
            : {}),
      },
    });

    res.json(family);
  } catch (error) {
    next(error);
  }
});

// Regenerate user auth code used for destructive actions
router.post('/auth-code/regenerate', isLoggedIn, async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { authCode: generateFamilyAuthCode(5) },
      select: { authCode: true },
    });
    res.json({ authCode: user.authCode });
  } catch (error) {
    next(error);
  }
});

// Export full backup of active family data (admin only)
router.get('/backup/export', isAuthenticated, requireAdmin, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const exportedAt = new Date().toISOString();

    const [
      family,
      dishes,
      mealPlans,
      mealOuts,
      shoppingLists,
      invites,
      chatMessages,
      notifications,
      members,
    ] = await Promise.all([
      prisma.family.findUnique({
        where: { id: familyId },
        select: {
          id: true,
          name: true,
          city: true,
          cityDisplayName: true,
          cityCountry: true,
          cityTimezone: true,
          cityLatitude: true,
          cityLongitude: true,
          createdAt: true,
        },
      }),
      prisma.dish.findMany({ where: { familyId }, orderBy: { createdAt: 'asc' } }),
      prisma.mealPlan.findMany({ where: { familyId }, orderBy: { createdAt: 'asc' } }),
      prisma.mealOut.findMany({ where: { familyId }, orderBy: { createdAt: 'asc' } }),
      prisma.shoppingList.findMany({ where: { familyId }, orderBy: { createdAt: 'asc' } }),
      prisma.familyInvite.findMany({ where: { familyId }, orderBy: { createdAt: 'asc' } }),
      prisma.chatMessage.findMany({ where: { familyId }, orderBy: { createdAt: 'asc' } }),
      prisma.notification.findMany({ where: { familyId }, orderBy: { createdAt: 'asc' } }),
      prisma.familyMember.findMany({
        where: { familyId },
        orderBy: { createdAt: 'asc' },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
    ]);

    res.json({
      schemaVersion: 1,
      exportedAt,
      family,
      members: members.map((m) => ({
        userId: m.userId,
        role: m.role,
        status: m.status,
        leftAt: m.leftAt,
        removedAt: m.removedAt,
        createdAt: m.createdAt,
        user: m.user,
      })),
      data: {
        dishes,
        mealPlans,
        mealOuts,
        shoppingLists,
        invites,
        chatMessages,
        notifications,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Restore selected sections from backup JSON into active family (admin only)
router.post('/backup/restore', isAuthenticated, requireAdmin, requireFamilyAuthCode, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const targets = sanitizeBackupTargets((req.body as any)?.targets);
    const backup = (req.body as any)?.backup;

    if (!backup || typeof backup !== 'object') {
      return res.status(400).json({ error: 'Backup payload mancante o non valido' });
    }
    if (!targets.length) {
      return res.status(400).json({ error: 'Seleziona almeno una sezione da ripristinare' });
    }

    const data = (backup as any).data || {};
    const dishRows = Array.isArray(data.dishes) ? data.dishes : [];
    const mealPlanRows = Array.isArray(data.mealPlans) ? data.mealPlans : [];
    const mealOutRows = Array.isArray(data.mealOuts) ? data.mealOuts : [];
    const shoppingRows = Array.isArray(data.shoppingLists) ? data.shoppingLists : [];
    const inviteRows = Array.isArray(data.invites) ? data.invites : [];
    const chatRows = Array.isArray(data.chatMessages) ? data.chatMessages : [];
    const notificationRows = Array.isArray(data.notifications) ? data.notifications : [];

    const userIdsInPayload = new Set<string>();
    for (const row of chatRows) {
      if (typeof row?.senderUserId === 'string') userIdsInPayload.add(row.senderUserId);
      if (typeof row?.recipientUserId === 'string') userIdsInPayload.add(row.recipientUserId);
    }
    for (const row of notificationRows) {
      if (typeof row?.userId === 'string') userIdsInPayload.add(row.userId);
    }
    const validUsers = userIdsInPayload.size
      ? await prisma.user.findMany({
          where: { id: { in: Array.from(userIdsInPayload) } },
          select: { id: true },
        })
      : [];
    const validUserIds = new Set(validUsers.map((u) => u.id));

    const summary = {
      restored: {
        dishes: 0,
        mealPlans: 0,
        mealOuts: 0,
        shoppingLists: 0,
        invites: 0,
        chatMessages: 0,
        notifications: 0,
      },
      skipped: {
        mealPlansInvalidDish: 0,
        chatMessagesInvalidUser: 0,
        notificationsInvalidUser: 0,
      },
    };

    await prisma.$transaction(async (tx) => {
      if (targets.includes('chats')) {
        await tx.chatMessage.deleteMany({ where: { familyId } });
        for (const row of chatRows) {
          const senderUserId =
            typeof row?.senderUserId === 'string' && validUserIds.has(row.senderUserId)
              ? row.senderUserId
              : null;
          const recipientUserId =
            typeof row?.recipientUserId === 'string' && validUserIds.has(row.recipientUserId)
              ? row.recipientUserId
              : null;

          if (typeof row?.senderUserId === 'string' && !senderUserId) {
            summary.skipped.chatMessagesInvalidUser += 1;
          }
          if (typeof row?.recipientUserId === 'string' && !recipientUserId) {
            summary.skipped.chatMessagesInvalidUser += 1;
          }

          await tx.chatMessage.create({
            data: {
              familyId,
              senderUserId,
              recipientUserId,
              messageType: typeof row?.messageType === 'string' ? row.messageType : 'user',
              content: typeof row?.content === 'string' ? row.content : '',
              createdAt: row?.createdAt ? new Date(row.createdAt) : new Date(),
            },
          });
          summary.restored.chatMessages += 1;
        }
      }

      if (targets.includes('notifications')) {
        await tx.notification.deleteMany({ where: { familyId } });
        for (const row of notificationRows) {
          if (typeof row?.userId !== 'string' || !validUserIds.has(row.userId)) {
            summary.skipped.notificationsInvalidUser += 1;
            continue;
          }
          await tx.notification.create({
            data: {
              userId: row.userId,
              familyId,
              type: typeof row?.type === 'string' ? row.type : 'generic',
              title: typeof row?.title === 'string' ? row.title : 'Notifica',
              message: typeof row?.message === 'string' ? row.message : '',
              isRead: Boolean(row?.isRead),
              data: row?.data ?? null,
              createdAt: row?.createdAt ? new Date(row.createdAt) : new Date(),
            },
          });
          summary.restored.notifications += 1;
        }
      }

      if (targets.includes('invites')) {
        await tx.familyInvite.deleteMany({ where: { familyId } });
        for (const row of inviteRows) {
          if (typeof row?.email !== 'string' || typeof row?.token !== 'string') continue;
          await tx.familyInvite.create({
            data: {
              familyId,
              email: row.email,
              token: row.token,
              expiresAt: row?.expiresAt ? new Date(row.expiresAt) : new Date(),
              usedAt: row?.usedAt ? new Date(row.usedAt) : null,
              createdAt: row?.createdAt ? new Date(row.createdAt) : new Date(),
            },
          });
          summary.restored.invites += 1;
        }
      }

      if (targets.includes('shopping')) {
        await tx.shoppingList.deleteMany({ where: { familyId } });
        for (const row of shoppingRows) {
          await tx.shoppingList.create({
            data: {
              familyId,
              weekStart: row?.weekStart ? new Date(row.weekStart) : new Date(),
              items: row?.items ?? [],
              createdAt: row?.createdAt ? new Date(row.createdAt) : new Date(),
            },
          });
          summary.restored.shoppingLists += 1;
        }
      }

      if (targets.includes('dishes')) {
        await tx.mealPlan.deleteMany({ where: { familyId } });
        await tx.dish.deleteMany({ where: { familyId } });
        for (const row of dishRows) {
          if (typeof row?.name !== 'string' || typeof row?.category !== 'string') continue;
          await tx.dish.create({
            data: {
              id: typeof row?.id === 'string' ? row.id : undefined,
              familyId,
              name: row.name,
              category: row.category,
              ingredients: Array.isArray(row?.ingredients) ? row.ingredients : [],
              createdAt: row?.createdAt ? new Date(row.createdAt) : new Date(),
            },
          });
          summary.restored.dishes += 1;
        }
      }

      if (targets.includes('planning')) {
        await tx.mealPlan.deleteMany({ where: { familyId } });
        await tx.mealOut.deleteMany({ where: { familyId } });

        const existingDishes = await tx.dish.findMany({
          where: { familyId },
          select: { id: true },
        });
        const dishIds = new Set(existingDishes.map((d) => d.id));

        for (const row of mealOutRows) {
          if (!row?.date || !row?.mealType) continue;
          await tx.mealOut.create({
            data: {
              familyId,
              date: new Date(row.date),
              mealType: row.mealType,
              createdAt: row?.createdAt ? new Date(row.createdAt) : new Date(),
            },
          });
          summary.restored.mealOuts += 1;
        }

        for (const row of mealPlanRows) {
          if (!row?.date || !row?.mealType || !row?.slotCategory || !row?.dishId) continue;
          if (!dishIds.has(row.dishId)) {
            summary.skipped.mealPlansInvalidDish += 1;
            continue;
          }
          await tx.mealPlan.create({
            data: {
              familyId,
              date: new Date(row.date),
              mealType: row.mealType,
              slotCategory: row.slotCategory,
              dishId: row.dishId,
              isSuggestion: Boolean(row?.isSuggestion),
              createdAt: row?.createdAt ? new Date(row.createdAt) : new Date(),
            },
          });
          summary.restored.mealPlans += 1;
        }
      }
    });

    res.json({ success: true, summary });
  } catch (error) {
    next(error);
  }
});

// Reset selected sections of active family data (admin only)
router.post('/reset', isAuthenticated, requireAdmin, requireFamilyAuthCode, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const targets = sanitizeBackupTargets((req.body as any)?.targets);
    if (!targets.length) {
      return res.status(400).json({ error: 'Seleziona almeno una sezione da resettare' });
    }

    const deleted = {
      dishes: 0,
      mealPlans: 0,
      mealOuts: 0,
      shoppingLists: 0,
      invites: 0,
      chatMessages: 0,
      notifications: 0,
    };

    await prisma.$transaction(async (tx) => {
      if (targets.includes('planning')) {
        const d1 = await tx.mealPlan.deleteMany({ where: { familyId } });
        const d2 = await tx.mealOut.deleteMany({ where: { familyId } });
        deleted.mealPlans = d1.count;
        deleted.mealOuts = d2.count;
      }
      if (targets.includes('chats')) {
        const d = await tx.chatMessage.deleteMany({ where: { familyId } });
        deleted.chatMessages = d.count;
      }
      if (targets.includes('dishes')) {
        const d1 = await tx.mealPlan.deleteMany({ where: { familyId } });
        const d2 = await tx.dish.deleteMany({ where: { familyId } });
        deleted.mealPlans += d1.count;
        deleted.dishes = d2.count;
      }
      if (targets.includes('shopping')) {
        const d = await tx.shoppingList.deleteMany({ where: { familyId } });
        deleted.shoppingLists = d.count;
      }
      if (targets.includes('invites')) {
        const d = await tx.familyInvite.deleteMany({ where: { familyId } });
        deleted.invites = d.count;
      }
      if (targets.includes('notifications')) {
        const d = await tx.notification.deleteMany({ where: { familyId } });
        deleted.notifications = d.count;
      }
    });

    res.json({ success: true, deleted });
  } catch (error) {
    next(error);
  }
});

// Create invite for active family
router.post('/invite', isAuthenticated, requireAdmin, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const alreadyMember = await prisma.familyMember.findFirst({
      where: {
        familyId,
        status: 'active',
        user: {
          email: normalizedEmail,
        },
      },
      select: { id: true },
    });

    if (alreadyMember) {
      return res.status(400).json({ error: 'User already in family' });
    }

    const token = uuidv4();
    const expiresAt = addDays(new Date(), 7);

    const invite = await prisma.familyInvite.create({
      data: {
        familyId,
        email: normalizedEmail,
        token,
        expiresAt,
      },
    });

    const inviteUrl = `${process.env.FRONTEND_URL}/invite/${token}`;

    res.json({
      invite: {
        id: invite.id,
        email: invite.email,
        expiresAt: invite.expiresAt,
        inviteUrl,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get pending invites for active family
router.get('/invites', isAuthenticated, requireAdmin, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);

    const invites = await prisma.familyInvite.findMany({
      where: {
        familyId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        email: true,
        expiresAt: true,
        createdAt: true,
        token: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const baseUrl = process.env.FRONTEND_URL;
    res.json(
      invites.map((invite) => ({
        ...invite,
        inviteUrl: baseUrl ? `${baseUrl}/invite/${invite.token}` : undefined,
      }))
    );
  } catch (error) {
    next(error);
  }
});

// Delete invite
router.delete('/invites/:id', isAuthenticated, requireAdmin, requireFamilyAuthCode, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { id } = req.params;

    await prisma.familyInvite.deleteMany({
      where: {
        id,
        familyId,
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Accept invite for an already authenticated user
router.post('/invite/:token/accept', isLoggedIn, async (req, res, next) => {
  try {
    const user = req.user!;
    const { token } = req.params;

    const result = await ensureInviteValid(token);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    const invite = result.invite;

    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      return res.status(403).json({ error: 'Invite email does not match current user' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.familyMember.upsert({
        where: {
          familyId_userId: {
            familyId: invite.familyId,
            userId: user.id,
          },
        },
        update: {
          status: 'active',
          leftAt: null,
          removedAt: null,
        },
        create: {
          familyId: invite.familyId,
          userId: user.id,
          role: 'member',
          status: 'active',
        },
      });

      await tx.familyInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });
    });

    req.session.activeFamilyId = invite.familyId;
    res.json({ success: true, activeFamilyId: invite.familyId });
  } catch (error) {
    next(error);
  }
});

// Update member role in active family (admin only)
router.put('/members/:userId/role', isAuthenticated, requireAdmin, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { userId } = req.params;
    const { role } = req.body ?? {};

    if (role !== 'admin' && role !== 'member') {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const target = await prisma.familyMember.findUnique({
      where: {
        familyId_userId: {
          familyId,
          userId,
        },
      },
      select: { userId: true, role: true, status: true },
    });

    if (!target || target.status !== 'active') {
      return res.status(404).json({ error: 'User not found in family' });
    }

    if (target.role === 'admin' && role === 'member') {
      const adminCount = await prisma.familyMember.count({
        where: { familyId, role: 'admin', status: 'active' },
      });
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Non puoi rimuovere l’ultimo admin della famiglia' });
      }
    }

    const updated = await prisma.familyMember.update({
      where: {
        familyId_userId: {
          familyId,
          userId,
        },
      },
      data: { role },
      select: { userId: true, role: true },
    });

    res.json({ user: { id: updated.userId, role: updated.role } });
  } catch (error) {
    next(error);
  }
});

// List members who left active family (admin only)
router.get('/former-members', isAuthenticated, requireAdmin, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);

    const formerMembers = await prisma.familyMember.findMany({
      where: {
        familyId,
        status: { in: ['left', 'removed'] },
      },
      select: {
        userId: true,
        role: true,
        leftAt: true,
        removedAt: true,
        status: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [{ leftAt: 'desc' }, { createdAt: 'desc' }],
    });

    res.json(
      formerMembers.map((member) => ({
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        avatarUrl: member.user.avatarUrl,
        previousRole: member.role,
        leftAt: member.leftAt,
        removedAt: member.removedAt,
        status: member.status,
        canRejoin: member.status === 'left',
      }))
    );
  } catch (error) {
    next(error);
  }
});

// Re-activate a former member in active family (admin only)
router.post('/former-members/:userId/rejoin', isAuthenticated, requireAdmin, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { userId } = req.params;

    const membership = await prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId, userId } },
      select: { status: true },
    });

    if (!membership || membership.status !== 'left') {
      return res.status(404).json({ error: 'Former member not found' });
    }

    await prisma.familyMember.update({
      where: { familyId_userId: { familyId, userId } },
      data: {
        status: 'active',
        leftAt: null,
        removedAt: null,
      },
    });

    await createNotifications([
      {
        userId,
        familyId,
        type: 'membership_reactivated',
        title: 'Rientro in famiglia',
        message: 'Un amministratore ti ha riammesso in famiglia.',
      },
    ]);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Mark a former member as removed (admin only, keep history but disable direct rejoin)
router.post('/former-members/:userId/remove', isAuthenticated, requireAdmin, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { userId } = req.params;

    const membership = await prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId, userId } },
      select: { status: true },
    });

    if (!membership || (membership.status !== 'left' && membership.status !== 'removed')) {
      return res.status(404).json({ error: 'Former member not found' });
    }

    if (membership.status === 'removed') {
      return res.json({ success: true });
    }

    await prisma.familyMember.update({
      where: { familyId_userId: { familyId, userId } },
      data: {
        status: 'removed',
        removedAt: new Date(),
      },
    });

    await createNotifications([
      {
        userId,
        familyId,
        type: 'membership_removed',
        title: 'Rimosso definitivamente dalla famiglia',
        message: 'Non puoi più rientrare direttamente: serve un nuovo invito.',
      },
    ]);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Validate invite token (public)
router.get('/invite/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    const result = await ensureInviteValid(token);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    const invite = result.invite;

    res.json({
      email: invite.email,
      family: invite.family,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
