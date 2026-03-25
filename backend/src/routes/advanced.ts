import { Router } from 'express';
import { addDays, addWeeks, endOfWeek, format, startOfWeek } from 'date-fns';
import prisma from '../prisma';
import { getFamilyId, isAuthenticated } from '../middleware/auth';
import { requireAdmin, requirePlanningWrite, requireShoppingWrite } from '../middleware/roles';
import { parseDateOnly } from '../utils/date';
import { generateSmartReminders } from '../services/reminders';
import { logAudit } from '../services/audit';

const router = Router();

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

router.get('/overview', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);

    const family = await prisma.family.findUnique({
      where: { id: familyId },
      select: {
        rotationWindowDays: true,
        maxWeeklyDishRepeat: true,
        eventModeEnabled: true,
        eventModeTitle: true,
        eventModeStart: true,
        eventModeEnd: true,
      },
    });

    const templates = await prisma.weeklyTemplate.count({ where: { familyId } });
    const pantryItems = await prisma.pantryItem.count({ where: { familyId } });
    const pendingInvites = await prisma.familyInvite.count({ where: { familyId, usedAt: null } });

    res.json({ family, counters: { templates, pantryItems, pendingInvites } });
  } catch (error) {
    next(error);
  }
});

router.post('/reminders/run', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const result = await generateSmartReminders(req.user!.id, familyId, req.activeFamilyRole!);
    await logAudit({
      familyId,
      userId: req.user!.id,
      action: 'REMINDERS_RUN',
      entityType: 'notification',
      details: result,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

router.put('/family-config', isAuthenticated, requireAdmin, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const rotationWindowDays = clamp(Number(req.body?.rotationWindowDays || 7), 1, 30);
    const maxWeeklyDishRepeat = clamp(Number(req.body?.maxWeeklyDishRepeat || 2), 1, 14);

    const updated = await prisma.family.update({
      where: { id: familyId },
      data: {
        rotationWindowDays,
        maxWeeklyDishRepeat,
      },
      select: {
        rotationWindowDays: true,
        maxWeeklyDishRepeat: true,
      },
    });

    await logAudit({
      familyId,
      userId: req.user!.id,
      action: 'UPDATE_ROTATION',
      entityType: 'family',
      entityId: familyId,
      details: updated,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.put('/event-mode', isAuthenticated, requireAdmin, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const enabled = Boolean(req.body?.enabled);
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const start = typeof req.body?.start === 'string' ? parseDateOnly(req.body.start) : null;
    const end = typeof req.body?.end === 'string' ? parseDateOnly(req.body.end) : null;

    const updated = await prisma.family.update({
      where: { id: familyId },
      data: {
        eventModeEnabled: enabled,
        eventModeTitle: title || null,
        eventModeStart: start,
        eventModeEnd: end,
      },
      select: {
        eventModeEnabled: true,
        eventModeTitle: true,
        eventModeStart: true,
        eventModeEnd: true,
      },
    });

    await logAudit({
      familyId,
      userId: req.user!.id,
      action: enabled ? 'EVENT_MODE_ENABLED' : 'EVENT_MODE_DISABLED',
      entityType: 'family',
      entityId: familyId,
      details: updated,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.get('/templates', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const templates = await prisma.weeklyTemplate.findMany({
      where: { familyId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            dish: {
              select: { id: true, name: true, category: true },
            },
          },
          orderBy: [{ dayOffset: 'asc' }, { mealType: 'asc' }, { slotCategory: 'asc' }],
        },
      },
    });
    res.json(templates);
  } catch (error) {
    next(error);
  }
});

router.post('/templates', isAuthenticated, requirePlanningWrite, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const weekStartRaw = typeof req.body?.weekStart === 'string' ? req.body.weekStart : '';

    if (!name) return res.status(400).json({ error: 'Nome template obbligatorio' });
    const parsedStart = parseDateOnly(weekStartRaw || format(new Date(), 'yyyy-MM-dd'));
    if (!parsedStart) return res.status(400).json({ error: 'Settimana non valida' });

    const weekStart = startOfWeek(parsedStart, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(parsedStart, { weekStartsOn: 1 });

    const meals = await prisma.mealPlan.findMany({
      where: {
        familyId,
        date: { gte: weekStart, lte: weekEnd },
      },
      select: {
        dishId: true,
        mealType: true,
        slotCategory: true,
        date: true,
      },
    });

    if (meals.length === 0) {
      return res.status(400).json({ error: 'Nessun pasto nella settimana selezionata' });
    }

    const template = await prisma.weeklyTemplate.create({
      data: {
        familyId,
        createdByUserId: req.user!.id,
        name,
        items: {
          create: meals.map((meal) => ({
            dayOffset: Math.floor((new Date(meal.date).getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000)),
            mealType: meal.mealType,
            slotCategory: meal.slotCategory,
            dishId: meal.dishId,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    await logAudit({
      familyId,
      userId: req.user!.id,
      action: 'TEMPLATE_CREATED',
      entityType: 'weekly_template',
      entityId: template.id,
      details: { name, itemCount: template.items.length },
    });

    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
});

router.post('/templates/:id/apply', isAuthenticated, requirePlanningWrite, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const templateId = req.params.id;
    const targetWeekStartRaw = typeof req.body?.targetWeekStart === 'string' ? req.body.targetWeekStart : '';
    const overwrite = Boolean(req.body?.overwrite);

    const parsedStart = parseDateOnly(targetWeekStartRaw || format(new Date(), 'yyyy-MM-dd'));
    if (!parsedStart) return res.status(400).json({ error: 'Settimana target non valida' });
    const targetWeekStart = startOfWeek(parsedStart, { weekStartsOn: 1 });

    const template = await prisma.weeklyTemplate.findFirst({
      where: { id: templateId, familyId },
      include: { items: true },
    });
    if (!template) return res.status(404).json({ error: 'Template non trovato' });

    let created = 0;
    let skipped = 0;

    await prisma.$transaction(async (tx) => {
      for (const item of template.items) {
        const targetDate = addWeeks(targetWeekStart, 0);
        targetDate.setDate(targetWeekStart.getDate() + item.dayOffset);

        const existing = await tx.mealPlan.findFirst({
          where: {
            familyId,
            date: targetDate,
            mealType: item.mealType,
            slotCategory: item.slotCategory,
          },
        });

        if (existing && !overwrite) {
          skipped += 1;
          continue;
        }

        if (existing && overwrite) {
          await tx.mealPlan.update({
            where: { id: existing.id },
            data: { dishId: item.dishId },
          });
          created += 1;
          continue;
        }

        await tx.mealPlan.create({
          data: {
            familyId,
            date: targetDate,
            mealType: item.mealType,
            slotCategory: item.slotCategory,
            dishId: item.dishId,
          },
        });
        created += 1;
      }
    });

    await logAudit({
      familyId,
      userId: req.user!.id,
      action: 'TEMPLATE_APPLIED',
      entityType: 'weekly_template',
      entityId: templateId,
      details: { created, skipped, overwrite },
    });

    res.json({ success: true, created, skipped });
  } catch (error) {
    next(error);
  }
});

router.delete('/templates/:id', isAuthenticated, requirePlanningWrite, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const templateId = req.params.id;
    await prisma.weeklyTemplate.deleteMany({ where: { id: templateId, familyId } });
    await logAudit({
      familyId,
      userId: req.user!.id,
      action: 'TEMPLATE_DELETED',
      entityType: 'weekly_template',
      entityId: templateId,
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/pantry', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const items = await prisma.pantryItem.findMany({
      where: { familyId },
      orderBy: [{ expiresAt: 'asc' }, { name: 'asc' }],
    });
    res.json(items);
  } catch (error) {
    next(error);
  }
});

router.post('/pantry', isAuthenticated, requireShoppingWrite, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) return res.status(400).json({ error: 'Nome ingrediente obbligatorio' });

    const expiresAt = typeof req.body?.expiresAt === 'string' ? parseDateOnly(req.body.expiresAt) : null;

    const item = await prisma.pantryItem.create({
      data: {
        familyId,
        createdByUserId: req.user!.id,
        name,
        quantity: typeof req.body?.quantity === 'string' ? req.body.quantity.trim() : null,
        unit: typeof req.body?.unit === 'string' ? req.body.unit.trim() : null,
        expiresAt,
      },
    });

    await logAudit({
      familyId,
      userId: req.user!.id,
      action: 'PANTRY_ITEM_CREATED',
      entityType: 'pantry_item',
      entityId: item.id,
      details: { name: item.name },
    });

    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

router.put('/pantry/:id', isAuthenticated, requireShoppingWrite, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const itemId = req.params.id;
    const expiresAt = typeof req.body?.expiresAt === 'string' ? parseDateOnly(req.body.expiresAt) : undefined;

    const item = await prisma.pantryItem.updateMany({
      where: { id: itemId, familyId },
      data: {
        name: typeof req.body?.name === 'string' ? req.body.name.trim() : undefined,
        quantity: typeof req.body?.quantity === 'string' ? req.body.quantity.trim() : undefined,
        unit: typeof req.body?.unit === 'string' ? req.body.unit.trim() : undefined,
        expiresAt,
      },
    });

    await logAudit({
      familyId,
      userId: req.user!.id,
      action: 'PANTRY_ITEM_UPDATED',
      entityType: 'pantry_item',
      entityId: itemId,
    });

    res.json({ success: true, updated: item.count });
  } catch (error) {
    next(error);
  }
});

router.delete('/pantry/:id', isAuthenticated, requireShoppingWrite, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const itemId = req.params.id;
    await prisma.pantryItem.deleteMany({ where: { id: itemId, familyId } });
    await logAudit({
      familyId,
      userId: req.user!.id,
      action: 'PANTRY_ITEM_DELETED',
      entityType: 'pantry_item',
      entityId: itemId,
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/pantry/suggestions', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const today = new Date(format(new Date(), 'yyyy-MM-dd'));
    const expiring = await prisma.pantryItem.findMany({
      where: {
        familyId,
        expiresAt: {
          gte: today,
          lte: addDays(today, 3),
        },
      },
      select: { name: true },
      take: 50,
    });

    const names = expiring.map((item) => item.name.trim().toLowerCase()).filter(Boolean);
    if (names.length === 0) return res.json([]);

    const dishes = await prisma.dish.findMany({
      where: { familyId },
      select: {
        id: true,
        name: true,
        category: true,
        ingredients: true,
      },
    });

    const scored = dishes
      .map((dish) => {
        const matchCount = (dish.ingredients || []).filter((ingredient) =>
          names.includes(String(ingredient).trim().toLowerCase())
        ).length;
        return {
          ...dish,
          matchCount,
        };
      })
      .filter((dish) => dish.matchCount > 0)
      .sort((a, b) => b.matchCount - a.matchCount)
      .slice(0, 12);

    res.json(scored);
  } catch (error) {
    next(error);
  }
});

router.post('/shopping/build-from-planning', isAuthenticated, requireShoppingWrite, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const weekRaw = typeof req.body?.weekStart === 'string' ? req.body.weekStart : format(new Date(), 'yyyy-MM-dd');
    const parsed = parseDateOnly(weekRaw);
    if (!parsed) return res.status(400).json({ error: 'Settimana non valida' });
    const weekStart = startOfWeek(parsed, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(parsed, { weekStartsOn: 1 });

    const meals = await prisma.mealPlan.findMany({
      where: {
        familyId,
        date: { gte: weekStart, lte: weekEnd },
      },
      include: { dish: true },
    });

    const counters = new Map<string, number>();
    for (const meal of meals) {
      for (const ingredient of meal.dish.ingredients || []) {
        const normalized = String(ingredient || '').trim();
        if (!normalized) continue;
        counters.set(normalized, (counters.get(normalized) || 0) + 1);
      }
    }

    const items = Array.from(counters.entries()).map(([ingredient, count]) => ({
      id: crypto.randomUUID(),
      ingredient,
      quantity: `x${count}`,
      checked: false,
      dishNames: [],
    }));

    await prisma.shoppingList.upsert({
      where: {
        familyId_weekStart: {
          familyId,
          weekStart,
        },
      },
      update: {
        items: JSON.stringify(items),
      },
      create: {
        familyId,
        weekStart,
        items: JSON.stringify(items),
      },
    });

    await logAudit({
      familyId,
      userId: req.user!.id,
      action: 'SHOPPING_BUILT_FROM_PLANNING',
      entityType: 'shopping_list',
      details: { weekStart: format(weekStart, 'yyyy-MM-dd'), items: items.length },
    });

    res.json({ success: true, items: items.length });
  } catch (error) {
    next(error);
  }
});

router.get('/costs/weekly', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const baseRaw = typeof req.query.weekStart === 'string' ? req.query.weekStart : format(new Date(), 'yyyy-MM-dd');
    const parsed = parseDateOnly(baseRaw);
    if (!parsed) return res.status(400).json({ error: 'Settimana non valida' });

    const baseWeek = startOfWeek(parsed, { weekStartsOn: 1 });
    const weeks = Array.from({ length: 8 }).map((_, index) => {
      const weekStart = addWeeks(baseWeek, -index);
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      return { weekStart, weekEnd };
    }).reverse();

    const result: { weekStart: string; estimatedCost: number; meals: number }[] = [];

    for (const range of weeks) {
      const meals = await prisma.mealPlan.findMany({
        where: {
          familyId,
          date: { gte: range.weekStart, lte: range.weekEnd },
        },
        include: {
          dish: {
            select: {
              estimatedCost: true,
            },
          },
        },
      });

      const estimatedCost = meals.reduce((sum, meal) => sum + (meal.dish.estimatedCost || 0), 0);
      result.push({
        weekStart: format(range.weekStart, 'yyyy-MM-dd'),
        estimatedCost: Number(estimatedCost.toFixed(2)),
        meals: meals.length,
      });
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.put('/dishes/:id/cost', isAuthenticated, requirePlanningWrite, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const dishId = req.params.id;
    const estimatedCost = Number(req.body?.estimatedCost);

    if (!Number.isFinite(estimatedCost) || estimatedCost < 0) {
      return res.status(400).json({ error: 'Costo stimato non valido' });
    }

    const dish = await prisma.dish.updateMany({
      where: { id: dishId, familyId },
      data: { estimatedCost: Number(estimatedCost.toFixed(2)) },
    });

    await logAudit({
      familyId,
      userId: req.user!.id,
      action: 'DISH_COST_UPDATED',
      entityType: 'dish',
      entityId: dishId,
      details: { estimatedCost: Number(estimatedCost.toFixed(2)) },
    });

    res.json({ success: true, updated: dish.count });
  } catch (error) {
    next(error);
  }
});

router.get('/roles', isAuthenticated, requireAdmin, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const members = await prisma.familyMember.findMany({
      where: {
        familyId,
        status: 'active',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });

    res.json(members.map((member) => ({
      userId: member.userId,
      name: member.user.name,
      email: member.user.email,
      role: member.role,
      canManagePlanning: member.canManagePlanning,
      canManageShopping: member.canManageShopping,
      canModerateChat: member.canModerateChat,
      isReadOnly: member.isReadOnly,
    })));
  } catch (error) {
    next(error);
  }
});

router.put('/roles/:userId', isAuthenticated, requireAdmin, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const userId = req.params.userId;

    const canManagePlanning = Boolean(req.body?.canManagePlanning);
    const canManageShopping = Boolean(req.body?.canManageShopping);
    const canModerateChat = Boolean(req.body?.canModerateChat);
    const isReadOnly = Boolean(req.body?.isReadOnly);

    if (userId === req.user!.id) {
      return res.status(400).json({ error: 'Non puoi cambiare i tuoi permessi da qui' });
    }

    const updated = await prisma.familyMember.updateMany({
      where: {
        familyId,
        userId,
        status: 'active',
      },
      data: {
        canManagePlanning,
        canManageShopping,
        canModerateChat,
        isReadOnly,
      },
    });

    await logAudit({
      familyId,
      userId: req.user!.id,
      action: 'MEMBER_PERMISSIONS_UPDATED',
      entityType: 'family_member',
      entityId: userId,
      details: { canManagePlanning, canManageShopping, canModerateChat, isReadOnly },
    });

    res.json({ success: true, updated: updated.count });
  } catch (error) {
    next(error);
  }
});

router.get('/audit', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? clamp(limitRaw, 10, 200) : 80;

    const logs = await prisma.auditLog.findMany({
      where: { familyId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json(logs);
  } catch (error) {
    next(error);
  }
});

export default router;
