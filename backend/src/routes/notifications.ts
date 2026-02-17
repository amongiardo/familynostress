import { Router } from 'express';
import prisma from '../prisma';
import { isLoggedIn } from '../middleware/auth';

const router = Router();

router.get('/', isLoggedIn, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20;

    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.notification.count({
        where: {
          userId,
          isRead: false,
        },
      }),
    ]);

    res.json({ items, unreadCount });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/read', isLoggedIn, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    await prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/read-all', isLoggedIn, async (req, res, next) => {
  try {
    const userId = req.user!.id;

    await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/read', isLoggedIn, async (req, res, next) => {
  try {
    const userId = req.user!.id;

    const deleted = await prisma.notification.deleteMany({
      where: {
        userId,
        isRead: true,
      },
    });

    res.json({ success: true, deletedCount: deleted.count });
  } catch (error) {
    next(error);
  }
});

export default router;
