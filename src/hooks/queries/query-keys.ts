export const queryKeys = {
  tasks: {
    all: ['tasks'] as const,
    lists: () => [...queryKeys.tasks.all, 'list'] as const,
    details: () => [...queryKeys.tasks.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.tasks.details(), id] as const,
    pendingCount: () => [...queryKeys.tasks.all, 'pending-count'] as const,
    childAssignments: () => [...queryKeys.tasks.all, 'child-assignments'] as const,
    childAssignment: (id: string) => [...queryKeys.tasks.all, 'child-assignment', id] as const,
  },
  balances: {
    all: ['balances'] as const,
    lists: () => [...queryKeys.balances.all, 'list'] as const,
    self: () => [...queryKeys.balances.all, 'self'] as const,
    byChild: (childId: string) => [...queryKeys.balances.all, 'by-child', childId] as const,
    transactions: (childId: string) =>
      [...queryKeys.balances.all, 'transactions', childId] as const,
  },
  children: {
    all: ['children'] as const,
    lists: () => [...queryKeys.children.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.children.all, 'detail', id] as const,
  },
  prizes: {
    all: ['prizes'] as const,
    lists: () => [...queryKeys.prizes.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.prizes.all, 'detail', id] as const,
    active: () => [...queryKeys.prizes.all, 'active'] as const,
    pendingRedemptionCount: () => [...queryKeys.prizes.all, 'pending-redemption-count'] as const,
  },
  redemptions: {
    all: ['redemptions'] as const,
    admin: () => [...queryKeys.redemptions.all, 'admin'] as const,
    child: () => [...queryKeys.redemptions.all, 'child'] as const,
  },
  profile: {
    all: ['profile'] as const,
    current: () => [...queryKeys.profile.all, 'current'] as const,
    authUser: () => [...queryKeys.profile.all, 'auth-user'] as const,
    notificationPrefs: () => [...queryKeys.profile.all, 'notification-prefs'] as const,
  },
  family: {
    all: ['family'] as const,
    detail: (id: string) => [...queryKeys.family.all, 'detail', id] as const,
  },
} as const;

export const STALE_TIMES = {
  tasks: 30_000,
  balances: 10_000,
  profile: 60_000,
  children: 60_000,
  prizes: 60_000,
  redemptions: 60_000,
  family: 60_000,
} as const;

export const PAGE_SIZES = {
  tasks: 20,
  prizes: 20,
  redemptions: 20,
  transactions: 20,
} as const;
