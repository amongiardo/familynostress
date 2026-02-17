export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  authCode?: string;
  oauthProvider: 'google' | 'github' | 'local';
  role?: 'admin' | 'member';
  familyId?: string;
  activeFamilyId?: string;
  families?: UserFamilyMembership[];
  createdAt: string;
}

export interface UserFamilyMembership {
  id: string;
  name: string;
  city?: string;
  role: 'admin' | 'member';
  createdAt: string;
}

export interface FormerFamilyMembership {
  id: string;
  name: string;
  city?: string;
  role: 'admin' | 'member';
  createdAt: string;
  membersCount: number;
  status: 'left' | 'removed';
  leftAt?: string | null;
  removedAt?: string | null;
  familyDeletedAt?: string | null;
  creatorName?: string | null;
  creatorEmail?: string | null;
  deletedByName?: string | null;
  deletedByEmail?: string | null;
  canRejoin: boolean;
  isEliminated?: boolean;
}

export interface Family {
  id: string;
  name: string;
  city?: string;
  cityDisplayName?: string;
  cityCountry?: string;
  cityTimezone?: string;
  cityLatitude?: number;
  cityLongitude?: number;
  authCode?: string;
  createdAt: string;
  role?: 'admin' | 'member';
  users: FamilyMember[];
}

export interface CitySearchResult {
  name: string;
  displayName: string;
  country?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
}

export interface FamilyMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: 'admin' | 'member';
}

export interface FamilyFormerMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  previousRole: 'admin' | 'member';
  leftAt?: string | null;
  removedAt?: string | null;
  status: 'left' | 'removed';
  canRejoin: boolean;
}

export interface AppNotification {
  id: string;
  userId: string;
  familyId?: string | null;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  data?: unknown;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  familyId: string;
  senderUserId?: string | null;
  recipientUserId?: string | null;
  messageType: 'user' | 'system';
  content: string;
  createdAt: string;
  sender?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
  recipient?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
}

export type DishCategory = 'primo' | 'secondo' | 'contorno';

export interface Dish {
  id: string;
  familyId: string;
  name: string;
  category: DishCategory;
  ingredients: string[];
  createdAt: string;
}

export type MealType = 'pranzo' | 'cena';

export interface MealPlan {
  id: string;
  familyId: string;
  date: string;
  mealType: MealType;
  slotCategory: DishCategory;
  dishId: string;
  dish: Dish;
  isSuggestion: boolean;
  createdAt: string;
}

export interface MealOut {
  id: string;
  familyId: string;
  date: string;
  mealType: MealType;
  createdAt: string;
}

export interface Suggestion {
  dish: {
    id: string;
    name: string;
    category: string;
  };
  score: number;
  reason: string;
}

export interface ShoppingListItem {
  id: string;
  ingredient: string;
  quantity?: string;
  checked: boolean;
  dishNames: string[];
  purchasedAt?: string | null;
}

export interface ShoppingList {
  id: string;
  familyId: string;
  weekStart: string;
  items: ShoppingListItem[];
  createdAt: string;
}

export interface FamilyInvite {
  id: string;
  email: string;
  expiresAt: string;
  createdAt: string;
  token?: string;
  inviteUrl?: string;
}
