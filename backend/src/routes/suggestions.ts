import { Router } from 'express';
import { DishCategory, MealType } from '@prisma/client';
import prisma from '../prisma';
import { isAuthenticated, getFamilyId } from '../middleware/auth';
import { getSuggestions } from '../services/suggestions';
import { parseDateOnly } from '../utils/date';

const router = Router();

// Get suggestions for a specific date and meal
router.get('/', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { date: dateStr, meal, category } = req.query;

    if (!dateStr || typeof dateStr !== 'string') {
      return res.status(400).json({ error: 'Date parameter is required (YYYY-MM-DD)' });
    }

    const date = parseDateOnly(dateStr);
    if (!date) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    if (!meal || !['pranzo', 'cena'].includes(meal as string)) {
      return res.status(400).json({ error: 'Valid meal parameter is required (pranzo or cena)' });
    }

    if (!category || !['primo', 'secondo', 'contorno'].includes(category as string)) {
      return res.status(400).json({ error: 'Valid category parameter is required (primo, secondo, contorno)' });
    }

    const suggestions = await getSuggestions(
      familyId,
      date,
      meal as MealType,
      category as DishCategory
    );

    res.json(suggestions);
  } catch (error) {
    next(error);
  }
});

// Accept a suggestion (create meal plan from suggestion)
router.post('/accept', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { date: dateStr, mealType, slotCategory, dishId } = req.body;

    if (!dateStr || typeof dateStr !== 'string') {
      return res.status(400).json({ error: 'Date is required' });
    }

    const date = parseDateOnly(dateStr);
    if (!date) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    if (!mealType || !['pranzo', 'cena'].includes(mealType)) {
      return res.status(400).json({ error: 'Valid meal type is required' });
    }

    if (!slotCategory || !['primo', 'secondo', 'contorno'].includes(slotCategory)) {
      return res.status(400).json({ error: 'Valid slot category is required' });
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

    const meal = await prisma.mealPlan.create({
      data: {
        familyId,
        date,
        mealType: mealType as MealType,
        slotCategory: slotCategory as DishCategory,
        dishId,
        isSuggestion: true,
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

export default router;
