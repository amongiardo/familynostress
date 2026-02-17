import { Router } from 'express';
import prisma from '../prisma';
import { isAuthenticated, getFamilyId } from '../middleware/auth';

const router = Router();

function normalizeDate(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getRangeDates(range: 'week' | 'month') {
  const end = normalizeDate(new Date());
  const days = range === 'month' ? 30 : 7;
  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));
  return { start, end };
}

router.get('/meals', isAuthenticated, async (req, res, next) => {
  try {
    const range = req.query.range === 'month' ? 'month' : 'week';
    const { start, end } = getRangeDates(range);
    const familyId = getFamilyId(req);

    const meals = await prisma.mealPlan.findMany({
      where: {
        familyId,
        date: { gte: start, lte: end },
      },
      include: { dish: true },
    });

    const dishCounts = new Map<
      string,
      { dishId: string; name: string; category: string; count: number }
    >();

    for (const meal of meals) {
      const dishId = meal.dishId;
      const existing = dishCounts.get(dishId);
      if (existing) {
        existing.count += 1;
      } else {
        dishCounts.set(dishId, {
          dishId,
          name: meal.dish.name,
          category: meal.dish.category,
          count: 1,
        });
      }
    }

    const frequent = Array.from(dishCounts.values()).sort((a, b) => b.count - a.count);
    const eatenIds = new Set(frequent.map((item) => item.dishId));

    const allDishes = await prisma.dish.findMany({ where: { familyId } });
    const notEaten = allDishes
      .filter((dish) => !eatenIds.has(dish.id))
      .map((dish) => ({
        dishId: dish.id,
        name: dish.name,
        category: dish.category,
      }));

    res.json({
      range,
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      frequent,
      notEaten,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
