import { Router } from 'express';
import { DishCategory, MealType } from '@prisma/client';
import { addDays, addMonths, addWeeks, differenceInCalendarDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subDays, subMonths, subWeeks } from 'date-fns';
import prisma from '../prisma';
import { isAuthenticated, getFamilyId } from '../middleware/auth';
import { requireFamilyAuthCode } from '../middleware/familyAuthCode';
import { parseDateOnly } from '../utils/date';

const router = Router();

function normalizeDateOnly(date: Date) {
  const dateStr = format(date, 'yyyy-MM-dd');
  return parseDateOnly(dateStr)!;
}

// Get meals for a week
router.get('/', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { week } = req.query;

    if (!week || typeof week !== 'string') {
      return res.status(400).json({ error: 'Week parameter is required (YYYY-MM-DD)' });
    }

    const date = parseDateOnly(week);
    if (!date) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });

    const meals = await prisma.mealPlan.findMany({
      where: {
        familyId,
        date: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      include: {
        dish: true,
      },
      orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
    });

    res.json(meals);
  } catch (error) {
    next(error);
  }
});

// Get meals for a date range
router.get('/range', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { start, end } = req.query;

    if (!start || typeof start !== 'string' || !end || typeof end !== 'string') {
      return res.status(400).json({ error: 'Start and end parameters are required (YYYY-MM-DD)' });
    }

    const startDate = parseDateOnly(start);
    const endDate = parseDateOnly(end);
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const meals = await prisma.mealPlan.findMany({
      where: {
        familyId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        dish: true,
      },
      orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
    });

    res.json(meals);
  } catch (error) {
    next(error);
  }
});

// Get meals for a specific date
router.get('/date/:date', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { date: dateStr } = req.params;

    const date = parseDateOnly(dateStr);
    if (!date) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const meals = await prisma.mealPlan.findMany({
      where: {
        familyId,
        date,
      },
      include: {
        dish: true,
      },
      orderBy: { mealType: 'asc' },
    });

    res.json(meals);
  } catch (error) {
    next(error);
  }
});

// Create meal plan
router.post('/', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { date: dateStr, mealType, slotCategory, dishId, isSuggestion } = req.body;

    if (!dateStr || typeof dateStr !== 'string') {
      return res.status(400).json({ error: 'Date is required' });
    }

    const date = parseDateOnly(dateStr);
    if (!date) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    if (!mealType || !['pranzo', 'cena'].includes(mealType)) {
      return res.status(400).json({ error: 'Valid meal type is required (pranzo or cena)' });
    }

    if (!slotCategory || !['primo', 'secondo', 'contorno'].includes(slotCategory)) {
      return res.status(400).json({ error: 'Valid slot category is required (primo, secondo, contorno)' });
    }

    if (!dishId || typeof dishId !== 'string') {
      return res.status(400).json({ error: 'Dish ID is required' });
    }

    // Verify dish belongs to family
    const dish = await prisma.dish.findFirst({
      where: { id: dishId, familyId },
    });

    if (!dish) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    if (dish.category !== slotCategory) {
      return res.status(400).json({ error: 'Dish category does not match slot category' });
    }

    const existingMeal = await prisma.mealPlan.findFirst({
      where: {
        familyId,
        date,
        mealType: mealType as MealType,
        slotCategory: slotCategory as DishCategory,
      },
      include: {
        dish: true,
      },
    });

    if (existingMeal) {
      return res.status(200).json(existingMeal);
    }

    const meal = await prisma.mealPlan.create({
      data: {
        familyId,
        date,
        mealType: mealType as MealType,
        slotCategory: slotCategory as DishCategory,
        dishId,
        isSuggestion: Boolean(isSuggestion),
      },
      include: {
        dish: true,
      },
    });

    res.status(201).json(meal);
  } catch (error) {
    next(error);
  }
});

// Update meal plan
router.put('/:id', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { id } = req.params;
    const { date: dateStr, mealType, slotCategory, dishId } = req.body;

    // Verify meal belongs to family
    const existing = await prisma.mealPlan.findFirst({
      where: { id, familyId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Meal plan not found' });
    }

    const updateData: any = {};

    if (dateStr) {
      const date = parseDateOnly(dateStr);
      if (!date) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
      updateData.date = date;
    }

    if (mealType && ['pranzo', 'cena'].includes(mealType)) {
      updateData.mealType = mealType as MealType;
    }

    if (slotCategory && ['primo', 'secondo', 'contorno'].includes(slotCategory)) {
      updateData.slotCategory = slotCategory as DishCategory;
    }

    if (updateData.slotCategory && !dishId) {
      const existingDish = await prisma.dish.findFirst({
        where: { id: existing.dishId, familyId },
      });
      if (existingDish && existingDish.category !== updateData.slotCategory) {
        return res.status(400).json({ error: 'Dish category does not match slot category' });
      }
    }

    if (dishId) {
      // Verify dish belongs to family
      const dish = await prisma.dish.findFirst({
        where: { id: dishId, familyId },
      });

      if (!dish) {
        return res.status(404).json({ error: 'Dish not found' });
      }

      if (updateData.slotCategory && dish.category !== updateData.slotCategory) {
        return res.status(400).json({ error: 'Dish category does not match slot category' });
      }

      if (!updateData.slotCategory && dish.category !== existing.slotCategory) {
        return res.status(400).json({ error: 'Dish category does not match slot category' });
      }

      updateData.dishId = dishId;
    }

    const nextDate = updateData.date ?? existing.date;
    const nextMealType = updateData.mealType ?? existing.mealType;
    const nextSlotCategory = updateData.slotCategory ?? existing.slotCategory;

    const slotTaken = await prisma.mealPlan.findFirst({
      where: {
        familyId,
        date: nextDate,
        mealType: nextMealType,
        slotCategory: nextSlotCategory,
        NOT: { id },
      },
    });

    if (slotTaken) {
      return res.status(409).json({ error: 'Slot già occupato per questa data' });
    }

    const meal = await prisma.mealPlan.update({
      where: { id },
      data: updateData,
      include: {
        dish: true,
      },
    });

    res.json(meal);
  } catch (error) {
    next(error);
  }
});

// Auto schedule meals for a date range (only empty slots)
router.post('/auto-schedule', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { rangeType, slots } = req.body as {
      rangeType?: string;
      slots?: { pranzo?: DishCategory[]; cena?: DishCategory[] };
    };

    const today = parseDateOnly(format(new Date(), 'yyyy-MM-dd'))!;
    let start: Date;
    let end: Date;

    switch (rangeType) {
      case 'last_week': {
        const base = subWeeks(today, 1);
        start = startOfWeek(base, { weekStartsOn: 1 });
        end = endOfWeek(base, { weekStartsOn: 1 });
        break;
      }
      case 'next_week': {
        const base = addWeeks(today, 1);
        start = startOfWeek(base, { weekStartsOn: 1 });
        end = endOfWeek(base, { weekStartsOn: 1 });
        break;
      }
      case 'this_month': {
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      }
      case 'last_month': {
        const base = subMonths(today, 1);
        start = startOfMonth(base);
        end = endOfMonth(base);
        break;
      }
      case 'next_month': {
        const base = addMonths(today, 1);
        start = startOfMonth(base);
        end = endOfMonth(base);
        break;
      }
      case 'last_7_days': {
        start = subDays(today, 6);
        end = today;
        break;
      }
      case 'next_7_days': {
        start = today;
        end = addDays(today, 6);
        break;
      }
      case 'workweek': {
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = addDays(start, 4);
        break;
      }
      case 'this_week':
      default: {
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = endOfWeek(today, { weekStartsOn: 1 });
        break;
      }
    }

    start = normalizeDateOnly(start);
    end = normalizeDateOnly(end);

    const dishes = await prisma.dish.findMany({ where: { familyId } });
    if (dishes.length === 0) {
      return res.status(400).json({ error: 'Nessun piatto disponibile. Inserisci o importa i piatti.' });
    }

    const dishesByCategory = {
      primo: dishes.filter((d) => d.category === 'primo'),
      secondo: dishes.filter((d) => d.category === 'secondo'),
      contorno: dishes.filter((d) => d.category === 'contorno'),
    };

    const slotsByMeal = {
      pranzo: (slots?.pranzo?.length ? slots.pranzo : ['primo', 'secondo', 'contorno']) as DishCategory[],
      cena: (slots?.cena?.length ? slots.cena : ['primo', 'secondo', 'contorno']) as DishCategory[],
    };

    const existing = await prisma.mealPlan.findMany({
      where: {
        familyId,
        date: { gte: start, lte: end },
      },
    });

    const existingKey = new Set(
      existing.map(
        (m) => `${format(new Date(m.date), 'yyyy-MM-dd')}|${m.mealType}|${m.slotCategory}`
      )
    );

    const lookbackStart = subDays(start, 6);
    const history = await prisma.mealPlan.findMany({
      where: {
        familyId,
        date: { gte: lookbackStart, lte: end },
      },
      include: { dish: true },
    });

    const lastUsed = new Map<string, Date>();
    const usedByDate = new Map<string, Set<string>>();
    history.forEach((meal) => {
      const dateKey = format(new Date(meal.date), 'yyyy-MM-dd');
      if (!usedByDate.has(dateKey)) usedByDate.set(dateKey, new Set());
      usedByDate.get(dateKey)!.add(meal.dishId);
      const prev = lastUsed.get(meal.dishId);
      const currentDate = new Date(meal.date);
      if (!prev || currentDate > prev) {
        lastUsed.set(meal.dishId, currentDate);
      }
    });

    const outs = await prisma.mealOut.findMany({
      where: { familyId, date: { gte: start, lte: end } },
    });
    const outKey = new Set(
      outs.map((out) => `${format(new Date(out.date), 'yyyy-MM-dd')}|${out.mealType}`)
    );

    const indexByKey = new Map<string, number>();

    console.log('AUTO-SCHEDULE RANGE', {
      rangeType,
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd'),
    });

    const planned: Array<{ date: Date; mealType: MealType; slotCategory: DishCategory; dishId: string }> =
      [];
    const neededByCategory: Record<DishCategory, number> = {
      primo: 0,
      secondo: 0,
      contorno: 0,
    };
    let missing = 0;

    for (let d = new Date(start); d <= end; d = normalizeDateOnly(addDays(d, 1))) {
      const dateKey = format(d, 'yyyy-MM-dd');
      const dayUsed = new Set(usedByDate.get(dateKey) ?? []);
      for (const mealType of ['pranzo', 'cena'] as MealType[]) {
        if (outKey.has(`${dateKey}|${mealType}`)) continue;
        const slotList = slotsByMeal[mealType];
        for (const slotCategory of slotList) {
          const key = `${dateKey}|${mealType}|${slotCategory}`;
          if (existingKey.has(key)) continue;

          const list = dishesByCategory[slotCategory];
          if (list.length === 0) {
            missing += 1;
            neededByCategory[slotCategory] += 1;
            continue;
          }

          const cycleKey = `${mealType}|${slotCategory}`;
          let idx = indexByKey.get(cycleKey) ?? 0;
          let chosen: { id: string } | null = null;

          for (let i = 0; i < list.length; i++) {
            const candidate = list[(idx + i) % list.length];
            if (dayUsed.has(candidate.id)) continue;
            const lastDate = lastUsed.get(candidate.id);
            if (lastDate && differenceInCalendarDays(d, lastDate) < 7) continue;
            chosen = candidate;
            idx = idx + i + 1;
            break;
          }

          if (!chosen) {
            missing += 1;
            neededByCategory[slotCategory] += 1;
            continue;
          }

          indexByKey.set(cycleKey, idx);
          dayUsed.add(chosen.id);
          lastUsed.set(chosen.id, d);
          planned.push({
            date: parseDateOnly(dateKey)!,
            mealType,
            slotCategory,
            dishId: chosen.id,
          });
        }
      }
    }

    if (missing > 0) {
      return res.json({ success: false, created: 0, missing, neededByCategory });
    }

    const created = await prisma.$transaction(async (tx) => {
      const createdMeals = await Promise.all(
        planned.map((data) =>
          tx.mealPlan.create({
            data: {
              familyId,
              date: data.date,
              mealType: data.mealType,
              slotCategory: data.slotCategory,
              dishId: data.dishId,
            },
          })
        )
      );
      return createdMeals.length;
    });

    res.json({ success: true, created, missing: 0, neededByCategory });
  } catch (error) {
    next(error);
  }
});

// Get meal outs for a date range
router.get('/outs', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { start, end } = req.query;

    if (!start || typeof start !== 'string' || !end || typeof end !== 'string') {
      return res.status(400).json({ error: 'Start and end parameters are required (YYYY-MM-DD)' });
    }

    const startDate = parseDateOnly(start);
    const endDate = parseDateOnly(end);
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const outs = await prisma.mealOut.findMany({
      where: {
        familyId,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });

    res.json(outs);
  } catch (error) {
    next(error);
  }
});

// Set meal out for a date/mealType (clears existing dishes)
router.post('/outs', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { date: dateStr, mealType } = req.body as { date?: string; mealType?: string };

    if (!dateStr || typeof dateStr !== 'string') {
      return res.status(400).json({ error: 'Date is required (YYYY-MM-DD)' });
    }
    if (!mealType || !['pranzo', 'cena'].includes(mealType)) {
      return res.status(400).json({ error: 'Invalid mealType' });
    }

    const date = parseDateOnly(dateStr);
    if (!date) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const out = await prisma.$transaction(async (tx) => {
      await tx.mealPlan.deleteMany({
        where: { familyId, date, mealType: mealType as MealType },
      });

      return tx.mealOut.upsert({
        where: {
          familyId_date_mealType: {
            familyId,
            date,
            mealType: mealType as MealType,
          },
        },
        update: {},
        create: {
          familyId,
          date,
          mealType: mealType as MealType,
        },
      });
    });

    res.json(out);
  } catch (error) {
    next(error);
  }
});

// Remove meal out for a date/mealType
router.delete('/outs', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { date: dateStr, mealType } = req.body as { date?: string; mealType?: string };

    if (!dateStr || typeof dateStr !== 'string') {
      return res.status(400).json({ error: 'Date is required (YYYY-MM-DD)' });
    }
    if (!mealType || !['pranzo', 'cena'].includes(mealType)) {
      return res.status(400).json({ error: 'Invalid mealType' });
    }

    const date = parseDateOnly(dateStr);
    if (!date) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    await prisma.mealOut.deleteMany({
      where: { familyId, date, mealType: mealType as MealType },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Delete meal plan
router.delete('/:id', isAuthenticated, requireFamilyAuthCode, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { id } = req.params;

    // Verify meal belongs to family
    const existing = await prisma.mealPlan.findFirst({
      where: { id, familyId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Meal plan not found' });
    }

    await prisma.mealPlan.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Clear all meal plans for family
router.delete('/', isAuthenticated, requireFamilyAuthCode, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const result = await prisma.mealPlan.deleteMany({
      where: { familyId },
    });
    res.json({ success: true, deleted: result.count });
  } catch (error) {
    next(error);
  }
});

// Clear meal plans for a date range (rangeType like auto-schedule)
router.post('/clear-range', isAuthenticated, requireFamilyAuthCode, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { rangeType } = req.body as { rangeType?: string };

    const today = parseDateOnly(format(new Date(), 'yyyy-MM-dd'))!;
    let start: Date;
    let end: Date;

    switch (rangeType) {
      case 'last_week': {
        const base = subWeeks(today, 1);
        start = startOfWeek(base, { weekStartsOn: 1 });
        end = endOfWeek(base, { weekStartsOn: 1 });
        break;
      }
      case 'next_week': {
        const base = addWeeks(today, 1);
        start = startOfWeek(base, { weekStartsOn: 1 });
        end = endOfWeek(base, { weekStartsOn: 1 });
        break;
      }
      case 'this_month': {
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      }
      case 'last_month': {
        const base = subMonths(today, 1);
        start = startOfMonth(base);
        end = endOfMonth(base);
        break;
      }
      case 'next_month': {
        const base = addMonths(today, 1);
        start = startOfMonth(base);
        end = endOfMonth(base);
        break;
      }
      case 'last_7_days': {
        start = subDays(today, 6);
        end = today;
        break;
      }
      case 'next_7_days': {
        start = today;
        end = addDays(today, 6);
        break;
      }
      case 'workweek': {
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = addDays(start, 4);
        break;
      }
      case 'this_week':
      default: {
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = endOfWeek(today, { weekStartsOn: 1 });
        break;
    }

    start = normalizeDateOnly(start);
    end = normalizeDateOnly(end);
    }

    const result = await prisma.mealPlan.deleteMany({
      where: {
        familyId,
        date: { gte: start, lte: end },
      },
    });

    res.json({ success: true, deleted: result.count });
  } catch (error) {
    next(error);
  }
});

export default router;
