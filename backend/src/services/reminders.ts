import { addDays, endOfDay, format, startOfDay } from 'date-fns';
import prisma from '../prisma';

async function hasRecentReminder(userId: string, familyId: string, type: string, hours = 12) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const count = await prisma.notification.count({
    where: {
      userId,
      familyId,
      type,
      createdAt: { gte: since },
    },
  });
  return count > 0;
}

function toDateOnly(date: Date) {
  return new Date(format(date, 'yyyy-MM-dd'));
}

export async function generateSmartReminders(userId: string, familyId: string, role: 'admin' | 'member') {
  const today = toDateOnly(new Date());
  const next3End = toDateOnly(addDays(today, 2));
  const next7End = toDateOnly(addDays(today, 6));

  const notifications: {
    userId: string;
    familyId: string;
    type: string;
    title: string;
    message: string;
    data?: any;
  }[] = [];

  const plannedSlots = await prisma.mealPlan.count({
    where: {
      familyId,
      date: {
        gte: startOfDay(today),
        lte: endOfDay(next3End),
      },
    },
  });
  const expectedSlots = 3 * 2 * 3;
  const missingSlots = Math.max(0, expectedSlots - plannedSlots);

  if (missingSlots > 0 && !(await hasRecentReminder(userId, familyId, 'smart_missing_planning'))) {
    notifications.push({
      userId,
      familyId,
      type: 'smart_missing_planning',
      title: 'Pianificazione incompleta',
      message: `Mancano ${missingSlots} slot pasti nei prossimi 3 giorni.`,
      data: { missingSlots },
    });
  }

  const pantryExpiring = await prisma.pantryItem.findMany({
    where: {
      familyId,
      expiresAt: {
        gte: startOfDay(today),
        lte: endOfDay(addDays(today, 2)),
      },
    },
    take: 5,
    orderBy: { expiresAt: 'asc' },
  });

  if (pantryExpiring.length > 0 && !(await hasRecentReminder(userId, familyId, 'smart_pantry_expiring'))) {
    const names = pantryExpiring.map((i) => i.name).join(', ');
    notifications.push({
      userId,
      familyId,
      type: 'smart_pantry_expiring',
      title: 'Ingredienti in scadenza',
      message: `In scadenza a breve: ${names}${pantryExpiring.length === 5 ? '...' : ''}`,
    });
  }

  const upcomingMeals = await prisma.mealPlan.findMany({
    where: {
      familyId,
      date: {
        gte: startOfDay(today),
        lte: endOfDay(next7End),
      },
    },
    include: {
      dish: {
        select: {
          ingredients: true,
        },
      },
    },
  });

  if (upcomingMeals.length > 0) {
    const neededIngredients = new Set<string>();
    for (const meal of upcomingMeals) {
      for (const ingredient of meal.dish.ingredients || []) {
        const normalized = String(ingredient || '').trim().toLowerCase();
        if (normalized) neededIngredients.add(normalized);
      }
    }

    if (neededIngredients.size > 0) {
      const pantryItems = await prisma.pantryItem.findMany({
        where: { familyId },
        select: { name: true },
      });
      const pantrySet = new Set(
        pantryItems
          .map((i) => i.name.trim().toLowerCase())
          .filter(Boolean)
      );

      let missingIngredients = 0;
      for (const ingredient of neededIngredients) {
        if (!pantrySet.has(ingredient)) missingIngredients += 1;
      }

      if (missingIngredients > 0 && !(await hasRecentReminder(userId, familyId, 'smart_missing_ingredients'))) {
        notifications.push({
          userId,
          familyId,
          type: 'smart_missing_ingredients',
          title: 'Ingredienti mancanti',
          message: `${missingIngredients} ingredienti pianificati non risultano in dispensa.`,
          data: { missingIngredients },
        });
      }
    }
  }

  if (role === 'admin') {
    const expiringInvites = await prisma.familyInvite.count({
      where: {
        familyId,
        usedAt: null,
        expiresAt: {
          gte: new Date(),
          lte: addDays(new Date(), 1),
        },
      },
    });

    if (expiringInvites > 0 && !(await hasRecentReminder(userId, familyId, 'smart_invites_expiring'))) {
      notifications.push({
        userId,
        familyId,
        type: 'smart_invites_expiring',
        title: 'Inviti in scadenza',
        message: `${expiringInvites} inviti scadono entro 24 ore.`,
      });
    }
  }

  if (notifications.length > 0) {
    await prisma.notification.createMany({ data: notifications });
  }

  return { created: notifications.length };
}
