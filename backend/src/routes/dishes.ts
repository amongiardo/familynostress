import { Router } from 'express';
import { DishCategory } from '@prisma/client';
import prisma from '../prisma';
import { isAuthenticated, getFamilyId } from '../middleware/auth';
import { requireFamilyAuthCode } from '../middleware/familyAuthCode';

const router = Router();

// Get all dishes for family
router.get('/', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { category, search } = req.query;

    const where: any = { familyId };

    if (category && ['primo', 'secondo', 'contorno'].includes(category as string)) {
      where.category = category as DishCategory;
    }

    if (search && typeof search === 'string') {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    const dishes = await prisma.dish.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json(dishes);
  } catch (error) {
    next(error);
  }
});

// Delete all dishes for family (and related meal plans)
router.delete('/all', isAuthenticated, requireFamilyAuthCode, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);

    const [deletedMeals, deletedDishes] = await prisma.$transaction([
      prisma.mealPlan.deleteMany({ where: { familyId } }),
      prisma.dish.deleteMany({ where: { familyId } }),
    ]);

    res.json({
      success: true,
      deletedMeals: deletedMeals.count,
      deletedDishes: deletedDishes.count,
    });
  } catch (error) {
    next(error);
  }
});

// Export dishes as CSV
router.get('/export', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const dishes = await prisma.dish.findMany({
      where: { familyId },
      orderBy: { name: 'asc' },
    });

    const header = 'name,category,ingredients';
    const lines = dishes.map((dish) => {
      const name = `"${dish.name.replace(/"/g, '""')}"`;
      const category = dish.category;
      const ingredients = `"${(dish.ingredients || [])
        .join(';')
        .replace(/"/g, '""')}"`;
      return `${name},${category},${ingredients}`;
    });

    res.json({ csv: [header, ...lines].join('\n') });
  } catch (error) {
    next(error);
  }
});

// Get single dish
router.get('/:id', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { id } = req.params;

    const dish = await prisma.dish.findFirst({
      where: { id, familyId },
    });

    if (!dish) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    res.json(dish);
  } catch (error) {
    next(error);
  }
});

// Create dish
router.post('/', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { name, category, ingredients } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!category || !['primo', 'secondo', 'contorno'].includes(category)) {
      return res.status(400).json({ error: 'Valid category is required' });
    }

    const dish = await prisma.dish.create({
      data: {
        familyId,
        name: name.trim(),
        category: category as DishCategory,
        ingredients: Array.isArray(ingredients) ? ingredients : [],
      },
    });

    res.status(201).json(dish);
  } catch (error) {
    next(error);
  }
});

// Update dish
router.put('/:id', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { id } = req.params;
    const { name, category, ingredients } = req.body;

    // Verify dish belongs to family
    const existing = await prisma.dish.findFirst({
      where: { id, familyId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    const updateData: any = {};

    if (name && typeof name === 'string') {
      updateData.name = name.trim();
    }

    if (category && ['primo', 'secondo', 'contorno'].includes(category)) {
      updateData.category = category as DishCategory;
    }

    if (Array.isArray(ingredients)) {
      updateData.ingredients = ingredients;
    }

    const dish = await prisma.dish.update({
      where: { id },
      data: updateData,
    });

    res.json(dish);
  } catch (error) {
    next(error);
  }
});

// Delete dish
router.delete('/:id', isAuthenticated, requireFamilyAuthCode, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { id } = req.params;

    // Verify dish belongs to family
    const existing = await prisma.dish.findFirst({
      where: { id, familyId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    await prisma.$transaction([
      prisma.mealPlan.deleteMany({ where: { familyId, dishId: id } }),
      prisma.dish.delete({ where: { id } }),
    ]);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
