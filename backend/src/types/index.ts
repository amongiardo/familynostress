import type { User as PrismaUser } from '@prisma/client';

declare global {
  namespace Express {
    interface User extends PrismaUser {}
    interface Request {
      activeFamilyId?: string;
      activeFamilyRole?: 'admin' | 'member';
      activeFamilyPermissions?: {
        canManagePlanning: boolean;
        canManageShopping: boolean;
        canModerateChat: boolean;
        isReadOnly: boolean;
      };
    }
  }
}

export interface ShoppingListItem {
  id: string;
  ingredient: string;
  quantity?: string;
  checked: boolean;
  dishNames: string[];
  purchasedAt?: string | null;
}

export interface SuggestionParams {
  date: string;
  mealType: 'pranzo' | 'cena';
  slotCategory: 'primo' | 'secondo' | 'contorno';
}

export interface SuggestionResult {
  dish: {
    id: string;
    name: string;
    category: string;
  };
  score: number;
  reason: string;
}
