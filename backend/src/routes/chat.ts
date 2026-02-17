import { Router } from 'express';
import prisma from '../prisma';
import { isAuthenticated, getFamilyId } from '../middleware/auth';
import { createNotifications } from '../services/notifications';

const router = Router();

router.get('/messages', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const userId = req.user!.id;
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 100;
    const membership = await prisma.familyMember.findUnique({
      where: {
        familyId_userId: {
          familyId,
          userId,
        },
      },
      select: {
        status: true,
        createdAt: true,
      },
    });

    if (!membership || membership.status !== 'active') {
      return res.status(403).json({ error: 'Not an active member of this family' });
    }

    const messages = await prisma.chatMessage.findMany({
      where: {
        familyId,
        createdAt: {
          gte: membership.createdAt,
        },
        OR: [
          { recipientUserId: null },
          { senderUserId: userId },
          { recipientUserId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        recipient: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    res.json(messages);
  } catch (error) {
    next(error);
  }
});

router.post('/messages', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const sender = req.user!;
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    const recipientUserId =
      typeof req.body?.recipientUserId === 'string' && req.body.recipientUserId.trim()
        ? req.body.recipientUserId.trim()
        : null;

    if (!content) {
      return res.status(400).json({ error: 'Messaggio vuoto' });
    }
    if (content.length > 2000) {
      return res.status(400).json({ error: 'Messaggio troppo lungo (max 2000 caratteri)' });
    }
    if (recipientUserId === sender.id) {
      return res.status(400).json({ error: 'Non puoi inviare un messaggio privato a te stesso' });
    }

    if (recipientUserId) {
      const recipientMembership = await prisma.familyMember.findUnique({
        where: {
          familyId_userId: {
            familyId,
            userId: recipientUserId,
          },
        },
        select: { status: true },
      });
      if (!recipientMembership || recipientMembership.status !== 'active') {
        return res.status(400).json({ error: 'Destinatario non valido' });
      }
    }

    const message = await prisma.chatMessage.create({
      data: {
        familyId,
        senderUserId: sender.id,
        recipientUserId,
        messageType: 'user',
        content,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        recipient: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    const preview = content.length > 72 ? `${content.slice(0, 72)}...` : content;
    const recipients = recipientUserId
      ? [{ userId: recipientUserId }]
      : await prisma.familyMember.findMany({
          where: {
            familyId,
            status: 'active',
            userId: { not: sender.id },
          },
          select: {
            userId: true,
          },
        });

    await createNotifications(
      recipients.map((member) => ({
        userId: member.userId,
        familyId,
        type: 'chat_message',
        title: recipientUserId ? 'Nuovo messaggio privato' : 'Nuovo messaggio in chat',
        message: `${sender.name}: ${preview}`,
        data: {
          messageId: message.id,
          isPrivate: Boolean(recipientUserId),
        },
      }))
    );

    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
});

export default router;
