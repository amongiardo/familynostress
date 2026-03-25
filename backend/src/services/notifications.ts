import prisma from '../prisma';

type CreateNotificationInput = {
  userId: string;
  familyId?: string | null;
  type: string;
  title: string;
  message: string;
  data?: unknown;
};

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      familyId: input.familyId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
      data: input.data === undefined ? undefined : (input.data as any),
    },
  });
}

export async function createNotifications(inputs: CreateNotificationInput[]) {
  if (!inputs.length) return;

  await prisma.notification.createMany({
    data: inputs.map((input) => ({
      userId: input.userId,
      familyId: input.familyId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
      data: input.data === undefined ? undefined : (input.data as any),
    })),
  });
}
