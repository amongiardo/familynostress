import { startOfWeek } from 'date-fns';
import prisma from '../prisma';
import { ShoppingListItem } from '../types';
import { v4 as uuidv4 } from 'uuid';

export async function getOrCreateShoppingList(familyId: string, weekStart: Date) {
  const normalizedWeekStart = startOfWeek(weekStart, { weekStartsOn: 1 });

  let shoppingList = await prisma.shoppingList.findUnique({
    where: {
      familyId_weekStart: {
        familyId,
        weekStart: normalizedWeekStart,
      },
    },
  });

  if (!shoppingList) {
    shoppingList = await prisma.shoppingList.create({
      data: {
        familyId,
        weekStart: normalizedWeekStart,
        items: JSON.stringify([]),
      },
    });
  }

  return {
    ...shoppingList,
    items: JSON.parse(shoppingList.items as string) as ShoppingListItem[],
  };
}

export async function addShoppingItem(
  familyId: string,
  weekStart: Date,
  ingredient: string,
  quantity?: string
) {
  const normalizedWeekStart = startOfWeek(weekStart, { weekStartsOn: 1 });
  const shoppingList = await getOrCreateShoppingList(familyId, normalizedWeekStart);

  const items = shoppingList.items as ShoppingListItem[];
  const newItem: ShoppingListItem = {
    id: uuidv4(),
    ingredient: ingredient.trim(),
    quantity: quantity?.trim() || '',
    checked: false,
    dishNames: [],
  };
  items.push(newItem);

  await prisma.shoppingList.update({
    where: {
      familyId_weekStart: {
        familyId,
        weekStart: normalizedWeekStart,
      },
    },
    data: {
      items: JSON.stringify(items),
    },
  });

  return newItem;
}

export async function updateItemCheckStatus(
  familyId: string,
  weekStart: Date,
  itemId: string,
  checked: boolean
) {
  const normalizedWeekStart = startOfWeek(weekStart, { weekStartsOn: 1 });

  const shoppingList = await prisma.shoppingList.findUnique({
    where: {
      familyId_weekStart: {
        familyId,
        weekStart: normalizedWeekStart,
      },
    },
  });

  if (!shoppingList) {
    throw new Error('Shopping list not found');
  }

  const items = JSON.parse(shoppingList.items as string) as ShoppingListItem[];
  const itemIndex = items.findIndex(item => item.id === itemId);

  if (itemIndex === -1) {
    throw new Error('Item not found');
  }

  items[itemIndex].checked = checked;
  items[itemIndex].purchasedAt = checked ? new Date().toISOString() : null;

  await prisma.shoppingList.update({
    where: {
      familyId_weekStart: {
        familyId,
        weekStart: normalizedWeekStart,
      },
    },
    data: {
      items: JSON.stringify(items),
    },
  });

  return items[itemIndex];
}

export async function clearShoppingList(familyId: string, weekStart: Date) {
  const normalizedWeekStart = startOfWeek(weekStart, { weekStartsOn: 1 });

  await prisma.shoppingList.update({
    where: {
      familyId_weekStart: {
        familyId,
        weekStart: normalizedWeekStart,
      },
    },
    data: {
      items: JSON.stringify([]),
    },
  });

  return { success: true };
}

export async function removeShoppingItem(
  familyId: string,
  weekStart: Date,
  itemId: string
) {
  const normalizedWeekStart = startOfWeek(weekStart, { weekStartsOn: 1 });

  const shoppingList = await prisma.shoppingList.findUnique({
    where: {
      familyId_weekStart: {
        familyId,
        weekStart: normalizedWeekStart,
      },
    },
  });

  if (!shoppingList) {
    throw new Error('Shopping list not found');
  }

  const items = JSON.parse(shoppingList.items as string) as ShoppingListItem[];
  const nextItems = items.filter((item) => item.id !== itemId);

  await prisma.shoppingList.update({
    where: {
      familyId_weekStart: {
        familyId,
        weekStart: normalizedWeekStart,
      },
    },
    data: {
      items: JSON.stringify(nextItems),
    },
  });

  return { success: true };
}

export async function clearAllShoppingLists(familyId: string) {
  await prisma.shoppingList.updateMany({
    where: {
      familyId,
    },
    data: {
      items: JSON.stringify([]),
    },
  });

  return { success: true };
}

export async function clearPurchasedItems(familyId: string) {
  const lists = await prisma.shoppingList.findMany({
    where: { familyId },
  });

  for (const list of lists) {
    const items = JSON.parse(list.items as string) as ShoppingListItem[];
    const nextItems = items.filter((item) => !item.checked);
    if (nextItems.length !== items.length) {
      await prisma.shoppingList.update({
        where: {
          familyId_weekStart: {
            familyId,
            weekStart: list.weekStart,
          },
        },
        data: {
          items: JSON.stringify(nextItems),
        },
      });
    }
  }

  return { success: true };
}

export async function clearPendingItems(familyId: string) {
  const lists = await prisma.shoppingList.findMany({
    where: { familyId },
  });

  for (const list of lists) {
    const items = JSON.parse(list.items as string) as ShoppingListItem[];
    const nextItems = items.filter((item) => item.checked);
    if (nextItems.length !== items.length) {
      await prisma.shoppingList.update({
        where: {
          familyId_weekStart: {
            familyId,
            weekStart: list.weekStart,
          },
        },
        data: {
          items: JSON.stringify(nextItems),
        },
      });
    }
  }

  return { success: true };
}
