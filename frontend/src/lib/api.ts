import {
  Dish,
  Family,
  MealPlan,
  MealOut,
  ShoppingList,
  Suggestion,
  User,
  FamilyInvite,
  CitySearchResult,
  FormerFamilyMembership,
  FamilyFormerMember,
  AppNotification,
  ChatMessage,
  WeeklyTemplate,
  PantryItem,
  AdvancedRoleMember,
  AuditLogItem,
} from '@/types';

// Default to same-origin so Next.js rewrites can proxy /auth and /api in dev.
const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').trim();

function buildApiUrl(path: string): string {
  if (!API_URL) return path;
  return `${API_URL.replace(/\/+$/, '')}${path}`;
}

function authCodeHeaders(authCode?: string): Record<string, string> {
  return authCode
    ? {
        'x-user-auth-code': authCode,
        'x-family-auth-code': authCode,
      }
    : {};
}

function activeFamilyHeaders(): Record<string, string> {
  if (typeof window === 'undefined') {
    return {};
  }
  const activeFamilyId = window.localStorage.getItem('activeFamilyId');
  return activeFamilyId ? { 'x-family-id': activeFamilyId } : {};
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...activeFamilyHeaders(),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    if (
      typeof window !== 'undefined' &&
      response.status === 403 &&
      (error.code === 'NO_ACTIVE_FAMILY' ||
        String(error.error || '').includes('No active family membership') ||
        String(error.error || '').includes('Non fai più parte di nessuna famiglia'))
    ) {
      window.localStorage.removeItem('activeFamilyId');
      window.sessionStorage.setItem(
        'authNotice',
        'Non fai più parte di nessuna famiglia. Registrati per crearne una nuova oppure attendi un nuovo invito.'
      );
      window.location.href = '/login?error=no_family';
    }
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Auth
export const authApi = {
  getMe: () => fetchApi<{ user: User | null }>('/auth/me'),
  logout: () => fetchApi<{ success: boolean }>('/auth/logout', { method: 'POST' }),
  getGoogleLoginUrl: () => buildApiUrl('/auth/google'),
  getGithubLoginUrl: () => buildApiUrl('/auth/github'),
  loginLocal: (data: { email: string; password: string }) =>
    fetchApi<{ user: User }>('/auth/local/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  registerLocal: (data: {
    email: string;
    password: string;
    name: string;
    familyName?: string;
    inviteToken?: string;
  }) =>
    fetchApi<{ user: User }>('/auth/local/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Family
export const familyApi = {
  get: () => fetchApi<Family>('/api/family'),
  mine: () =>
    fetchApi<{
      activeFamilyId: string | null;
      families: {
        id: string;
        name: string;
        city?: string;
        role: 'admin' | 'member';
        createdAt: string;
        membersCount: number;
        status: 'active';
      }[];
      formerFamilies: FormerFamilyMembership[];
    }>('/api/family/mine'),
  switchActive: (familyId: string) =>
    fetchApi<{ success: boolean; activeFamilyId: string }>('/api/family/switch', {
      method: 'POST',
      body: JSON.stringify({ familyId }),
    }),
  create: (data: {
    name: string;
    city?: string;
    citySelection?: {
      name: string;
      displayName?: string;
      country?: string;
      timezone?: string;
      latitude?: number;
      longitude?: number;
    };
    switchToNewFamily?: boolean;
  }) =>
    fetchApi<{
      family: { id: string; name: string; city?: string; createdAt: string; role: 'admin' | 'member' };
      activeFamilyId: string | null;
    }>('/api/family/create', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteFamily: (familyId: string, authCode: string, targetFamilyId?: string) =>
    fetchApi<{ success: boolean; activeFamilyId: string | null }>(`/api/family/${familyId}`, {
      method: 'DELETE',
      headers: authCodeHeaders(authCode),
      body: targetFamilyId ? JSON.stringify({ targetFamilyId }) : undefined,
    }),
  leaveFamily: (familyId: string, targetFamilyId?: string) =>
    fetchApi<{ success: boolean; activeFamilyId: string | null }>(`/api/family/${familyId}/leave`, {
      method: 'POST',
      body: targetFamilyId ? JSON.stringify({ targetFamilyId }) : undefined,
    }),
  rejoinFamily: (familyId: string) =>
    fetchApi<{ success: boolean; activeFamilyId: string }>(`/api/family/${familyId}/rejoin`, {
      method: 'POST',
    }),
  forgetFormerFamily: (familyId: string) =>
    fetchApi<{ success: boolean }>(`/api/family/${familyId}/former-membership`, {
      method: 'DELETE',
    }),
  update: (data: {
    name?: string;
    city?: string;
    citySelection?: {
      name: string;
      displayName?: string;
      country?: string;
      timezone?: string;
      latitude?: number;
      longitude?: number;
    };
  }) => fetchApi<Family>('/api/family', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  updateMemberRole: (userId: string, role: 'admin' | 'member') =>
    fetchApi<{ user: { id: string; role: 'admin' | 'member' } }>(`/api/family/members/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),
  getFormerMembers: () => fetchApi<FamilyFormerMember[]>('/api/family/former-members'),
  rejoinFormerMember: (userId: string) =>
    fetchApi<{ success: boolean }>(`/api/family/former-members/${userId}/rejoin`, {
      method: 'POST',
    }),
  removeFormerMember: (userId: string) =>
    fetchApi<{ success: boolean }>(`/api/family/former-members/${userId}/remove`, {
      method: 'POST',
    }),
  regenerateAuthCode: () =>
    fetchApi<{ authCode: string }>('/api/family/auth-code/regenerate', { method: 'POST' }),
  exportBackup: () =>
    fetchApi<any>('/api/family/backup/export'),
  restoreBackup: (backup: any, targets: string[], authCode: string) =>
    fetchApi<{ success: boolean; summary: any }>('/api/family/backup/restore', {
      method: 'POST',
      headers: authCodeHeaders(authCode),
      body: JSON.stringify({ backup, targets }),
    }),
  resetData: (targets: string[], authCode: string) =>
    fetchApi<{ success: boolean; deleted: any }>('/api/family/reset', {
      method: 'POST',
      headers: authCodeHeaders(authCode),
      body: JSON.stringify({ targets }),
    }),
  invite: (email: string) => fetchApi<{ invite: FamilyInvite }>('/api/family/invite', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }),
  getInvites: () => fetchApi<FamilyInvite[]>('/api/family/invites'),
  deleteInvite: (id: string, authCode: string) => fetchApi<{ success: boolean }>(`/api/family/invites/${id}`, {
    method: 'DELETE',
    headers: authCodeHeaders(authCode),
  }),
  acceptInvite: (token: string) =>
    fetchApi<{ success: boolean; activeFamilyId: string }>(`/api/family/invite/${token}/accept`, {
      method: 'POST',
    }),
  validateInvite: (token: string) => fetchApi<{ email: string; family: { id: string; name: string } }>(`/api/family/invite/${token}`),
};

// Weather
export const weatherApi = {
  get: () => fetchApi<{ city: string; temperature?: number; description?: string }>('/api/weather'),
  searchCities: (query: string, scope: 'world' | 'it' = 'world') =>
    fetchApi<{ results: CitySearchResult[] }>(
      `/api/weather/cities?query=${encodeURIComponent(query)}&scope=${scope}`
    ),
};

export const notificationsApi = {
  list: (limit = 20) =>
    fetchApi<{ items: AppNotification[]; unreadCount: number }>(`/api/notifications?limit=${limit}`),
  markRead: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () =>
    fetchApi<{ success: boolean }>('/api/notifications/read-all', { method: 'POST' }),
  deleteRead: () =>
    fetchApi<{ success: boolean; deletedCount: number }>('/api/notifications/read', { method: 'DELETE' }),
};

export const chatApi = {
  listMessages: (limit = 100) =>
    fetchApi<ChatMessage[]>(`/api/chat/messages?limit=${limit}`),
  sendMessage: (content: string, recipientUserId?: string) =>
    fetchApi<ChatMessage>('/api/chat/messages', {
      method: 'POST',
      body: JSON.stringify({ content, recipientUserId }),
    }),
};

export const advancedApi = {
  overview: () =>
    fetchApi<{
      family: {
        rotationWindowDays: number;
        maxWeeklyDishRepeat: number;
        eventModeEnabled: boolean;
        eventModeTitle?: string | null;
        eventModeStart?: string | null;
        eventModeEnd?: string | null;
      };
      counters: {
        templates: number;
        pantryItems: number;
        pendingInvites: number;
      };
    }>('/api/advanced/overview'),
  runReminders: () =>
    fetchApi<{ success: boolean; created: number }>('/api/advanced/reminders/run', { method: 'POST' }),
  updateFamilyConfig: (data: { rotationWindowDays: number; maxWeeklyDishRepeat: number }) =>
    fetchApi<{ rotationWindowDays: number; maxWeeklyDishRepeat: number }>('/api/advanced/family-config', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  updateEventMode: (data: { enabled: boolean; title?: string; start?: string; end?: string }) =>
    fetchApi<{
      eventModeEnabled: boolean;
      eventModeTitle?: string | null;
      eventModeStart?: string | null;
      eventModeEnd?: string | null;
    }>('/api/advanced/event-mode', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  listTemplates: () => fetchApi<WeeklyTemplate[]>('/api/advanced/templates'),
  createTemplate: (data: { name: string; weekStart: string }) =>
    fetchApi<WeeklyTemplate>('/api/advanced/templates', { method: 'POST', body: JSON.stringify(data) }),
  applyTemplate: (templateId: string, data: { targetWeekStart: string; overwrite: boolean }) =>
    fetchApi<{ success: boolean; created: number; skipped: number }>(`/api/advanced/templates/${templateId}/apply`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteTemplate: (templateId: string) =>
    fetchApi<{ success: boolean }>(`/api/advanced/templates/${templateId}`, { method: 'DELETE' }),
  pantryList: () => fetchApi<PantryItem[]>('/api/advanced/pantry'),
  pantryCreate: (data: { name: string; quantity?: string; unit?: string; expiresAt?: string }) =>
    fetchApi<PantryItem>('/api/advanced/pantry', { method: 'POST', body: JSON.stringify(data) }),
  pantryDelete: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/advanced/pantry/${id}`, { method: 'DELETE' }),
  pantrySuggestions: () =>
    fetchApi<Array<{ id: string; name: string; category: string; ingredients: string[]; matchCount: number }>>(
      '/api/advanced/pantry/suggestions'
    ),
  buildShoppingFromPlanning: (weekStart: string) =>
    fetchApi<{ success: boolean; items: number }>('/api/advanced/shopping/build-from-planning', {
      method: 'POST',
      body: JSON.stringify({ weekStart }),
    }),
  weeklyCosts: (weekStart: string) =>
    fetchApi<Array<{ weekStart: string; estimatedCost: number; meals: number }>>(
      `/api/advanced/costs/weekly?weekStart=${encodeURIComponent(weekStart)}`
    ),
  updateDishCost: (dishId: string, estimatedCost: number) =>
    fetchApi<{ success: boolean; updated: number }>(`/api/advanced/dishes/${dishId}/cost`, {
      method: 'PUT',
      body: JSON.stringify({ estimatedCost }),
    }),
  listRoles: () => fetchApi<AdvancedRoleMember[]>('/api/advanced/roles'),
  updateRolePermissions: (
    userId: string,
    data: {
      canManagePlanning: boolean;
      canManageShopping: boolean;
      canModerateChat: boolean;
      isReadOnly: boolean;
    }
  ) =>
    fetchApi<{ success: boolean; updated: number }>(`/api/advanced/roles/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  listAudit: (limit = 80) => fetchApi<AuditLogItem[]>(`/api/advanced/audit?limit=${limit}`),
};

// Stats
export const statsApi = {
  meals: (range: 'week' | 'month') =>
    fetchApi<{
      range: 'week' | 'month';
      start: string;
      end: string;
      frequent: { dishId: string; name: string; category: string; count: number }[];
      notEaten: { dishId: string; name: string; category: string }[];
    }>(`/api/stats/meals?range=${range}`),
};

// Dishes
export const dishesApi = {
  list: (params?: { category?: string; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set('category', params.category);
    if (params?.search) searchParams.set('search', params.search);
    const query = searchParams.toString();
    return fetchApi<Dish[]>(`/api/dishes${query ? `?${query}` : ''}`);
  },
  get: (id: string) => fetchApi<Dish>(`/api/dishes/${id}`),
  create: (data: { name: string; category: string; ingredients: string[] }) =>
    fetchApi<Dish>('/api/dishes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<{ name: string; category: string; ingredients: string[] }>) =>
    fetchApi<Dish>(`/api/dishes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string, authCode: string) => fetchApi<{ success: boolean }>(`/api/dishes/${id}`, {
    method: 'DELETE',
    headers: authCodeHeaders(authCode),
  }),
  exportCsv: () => fetchApi<{ csv: string }>('/api/dishes/export'),
  deleteAll: (authCode: string) => fetchApi<{ success: boolean; deletedMeals: number; deletedDishes: number }>(
    '/api/dishes/all',
    { method: 'DELETE', headers: authCodeHeaders(authCode) }
  ),
};

// Meals
export const mealsApi = {
  getWeek: (week: string) => fetchApi<MealPlan[]>(`/api/meals?week=${week}`),
  getRange: (start: string, end: string) =>
    fetchApi<MealPlan[]>(`/api/meals/range?start=${start}&end=${end}`),
  getDate: (date: string) => fetchApi<MealPlan[]>(`/api/meals/date/${date}`),
  getOutRange: (start: string, end: string) =>
    fetchApi<MealOut[]>(`/api/meals/outs?start=${start}&end=${end}`),
  setOut: (data: { date: string; mealType: string }, authCode?: string) =>
    fetchApi<MealOut>('/api/meals/outs', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: authCodeHeaders(authCode),
    }),
  removeOut: (data: { date: string; mealType: string }, authCode?: string) =>
    fetchApi<{ success: boolean }>('/api/meals/outs', {
      method: 'DELETE',
      body: JSON.stringify(data),
      headers: authCodeHeaders(authCode),
    }),
  create: (data: { date: string; mealType: string; slotCategory: string; dishId: string; isSuggestion?: boolean }) =>
    fetchApi<MealPlan>('/api/meals', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<{ date: string; mealType: string; slotCategory: string; dishId: string }>) =>
    fetchApi<MealPlan>(`/api/meals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string, authCode: string) => fetchApi<{ success: boolean }>(`/api/meals/${id}`, {
    method: 'DELETE',
    headers: authCodeHeaders(authCode),
  }),
  clearAll: (authCode: string) => fetchApi<{ success: boolean; deleted: number }>('/api/meals', {
    method: 'DELETE',
    headers: authCodeHeaders(authCode),
  }),
  clearRange: (data: { rangeType: string }, authCode: string) =>
    fetchApi<{ success: boolean; deleted: number }>('/api/meals/clear-range', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: authCodeHeaders(authCode),
    }),
  autoSchedule: (data: { rangeType: string; slots?: { pranzo?: string[]; cena?: string[] } }) =>
    fetchApi<{ success: boolean; created: number; missing?: number; neededByCategory?: { primo: number; secondo: number; contorno: number } }>(
      '/api/meals/auto-schedule',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),
};

// Suggestions
export const suggestionsApi = {
  get: (date: string, meal: string, category: string) =>
    fetchApi<Suggestion[]>(`/api/suggestions?date=${date}&meal=${meal}&category=${category}`),
  accept: (data: { date: string; mealType: string; slotCategory: string; dishId: string }) =>
    fetchApi<MealPlan>('/api/suggestions/accept', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Shopping
export const shoppingApi = {
  get: (week: string) => fetchApi<ShoppingList>(`/api/shopping?week=${week}`),
  addItem: (data: { week: string; ingredient: string; quantity?: string }) =>
    fetchApi<{ id: string; ingredient: string; quantity?: string; checked: boolean; dishNames: string[] }>(
      '/api/shopping/items',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),
  checkItem: (itemId: string, week: string, checked: boolean) =>
    fetchApi<{ id: string; checked: boolean }>(`/api/shopping/${itemId}/check`, {
      method: 'PUT',
      body: JSON.stringify({ week, checked }),
    }),
  removeItem: (itemId: string, week: string, authCode: string) =>
    fetchApi<{ success: boolean }>(`/api/shopping/items/${itemId}?week=${week}`, {
      method: 'DELETE',
      headers: authCodeHeaders(authCode),
    }),
  clear: (week: string, authCode: string) =>
    fetchApi<{ success: boolean }>(`/api/shopping?week=${week}`, { method: 'DELETE', headers: authCodeHeaders(authCode) }),
  clearAll: (authCode: string) =>
    fetchApi<{ success: boolean }>(`/api/shopping/all`, { method: 'DELETE', headers: authCodeHeaders(authCode) }),
  clearPurchased: (authCode: string) =>
    fetchApi<{ success: boolean }>(`/api/shopping/purchased`, { method: 'DELETE', headers: authCodeHeaders(authCode) }),
  clearPending: (authCode: string) =>
    fetchApi<{ success: boolean }>(`/api/shopping/pending`, { method: 'DELETE', headers: authCodeHeaders(authCode) }),
};
