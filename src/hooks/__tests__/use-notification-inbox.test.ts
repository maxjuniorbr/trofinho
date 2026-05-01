import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDeriveAdminNotifs = vi.hoisted(() => vi.fn(() => []));
const mockDeriveChildNotifs = vi.hoisted(() => vi.fn(() => []));

const mockUseAdminTasks = vi.hoisted(() => vi.fn());
const mockUsePendingValidationCount = vi.hoisted(() => vi.fn());
const mockUseChildAssignments = vi.hoisted(() => vi.fn());
const mockUseAdminRedemptions = vi.hoisted(() => vi.fn());
const mockUsePendingRedemptionCount = vi.hoisted(() => vi.fn());
const mockUseChildRedemptions = vi.hoisted(() => vi.fn());
const mockUseProfile = vi.hoisted(() => vi.fn());
const mockUseMyChildId = vi.hoisted(() => vi.fn());
const mockUseTransactionsByPeriod = vi.hoisted(() => vi.fn());

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useMemo: <T>(fn: () => T) => fn(),
  };
});

vi.mock('@lib/notification-inbox', () => ({
  deriveAdminNotifs: mockDeriveAdminNotifs,
  deriveChildNotifs: mockDeriveChildNotifs,
}));

vi.mock('@/hooks/queries/use-tasks', () => ({
  useAdminTasks: mockUseAdminTasks,
  usePendingValidationCount: mockUsePendingValidationCount,
  useChildAssignments: mockUseChildAssignments,
}));

vi.mock('@/hooks/queries/use-redemptions', () => ({
  useAdminRedemptions: mockUseAdminRedemptions,
  usePendingRedemptionCount: mockUsePendingRedemptionCount,
  useChildRedemptions: mockUseChildRedemptions,
}));

vi.mock('@/hooks/queries/use-profile', () => ({
  useProfile: mockUseProfile,
}));

vi.mock('@/hooks/queries/use-children', () => ({
  useMyChildId: mockUseMyChildId,
}));

vi.mock('@/hooks/queries/use-balances', () => ({
  useTransactionsByPeriod: mockUseTransactionsByPeriod,
}));

function makeInfiniteQueryResult(
  data: unknown[] | undefined,
  opts?: { isLoading?: boolean; isError?: boolean },
) {
  return {
    data: data ? { pages: [{ data }] } : undefined,
    isLoading: opts?.isLoading ?? false,
    isError: opts?.isError ?? false,
  };
}

function makeQueryResult(data: unknown, opts?: { isLoading?: boolean; isError?: boolean }) {
  return {
    data,
    isLoading: opts?.isLoading ?? false,
    isError: opts?.isError ?? false,
  };
}

beforeEach(() => {
  mockDeriveAdminNotifs.mockReset().mockReturnValue([]);
  mockDeriveChildNotifs.mockReset().mockReturnValue([]);
  mockUseAdminTasks.mockReset().mockReturnValue(makeInfiniteQueryResult([]));
  mockUsePendingValidationCount.mockReset().mockReturnValue(makeQueryResult(0));
  mockUseChildAssignments.mockReset().mockReturnValue(makeInfiniteQueryResult([]));
  mockUseAdminRedemptions.mockReset().mockReturnValue(makeInfiniteQueryResult([]));
  mockUsePendingRedemptionCount.mockReset().mockReturnValue(makeQueryResult(0));
  mockUseChildRedemptions.mockReset().mockReturnValue(makeInfiniteQueryResult([]));
  mockUseProfile.mockReset().mockReturnValue(makeQueryResult({ id: 'user-1' }));
  mockUseMyChildId.mockReset().mockReturnValue(makeQueryResult('child-1'));
  mockUseTransactionsByPeriod.mockReset().mockReturnValue(makeQueryResult([]));
});

const loadHooks = () => import('../use-notification-inbox');

describe('useAdminNotifInbox', () => {
  it('returns empty items when no tasks or redemptions', async () => {
    const { useAdminNotifInbox } = await loadHooks();
    const result = useAdminNotifInbox();
    expect(result.items).toEqual([]);
    expect(result.isLoading).toBe(false);
    expect(result.isError).toBe(false);
  });

  it('passes tasks and redemptions to deriveAdminNotifs', async () => {
    const tasks = [{ id: '1', titulo: 'Task 1' }];
    const redemptions = [{ id: '2', status: 'pendente' }];
    mockUseAdminTasks.mockReturnValue(makeInfiniteQueryResult(tasks));
    mockUseAdminRedemptions.mockReturnValue(makeInfiniteQueryResult(redemptions));

    const { useAdminNotifInbox } = await loadHooks();
    useAdminNotifInbox();

    expect(mockDeriveAdminNotifs).toHaveBeenCalledWith({
      tasks,
      redemptions,
    });
  });

  it('returns isLoading true when tasks are loading', async () => {
    mockUseAdminTasks.mockReturnValue(makeInfiniteQueryResult(undefined, { isLoading: true }));

    const { useAdminNotifInbox } = await loadHooks();
    const result = useAdminNotifInbox();
    expect(result.isLoading).toBe(true);
  });

  it('returns isLoading true when redemptions are loading', async () => {
    mockUseAdminRedemptions.mockReturnValue(
      makeInfiniteQueryResult(undefined, { isLoading: true }),
    );

    const { useAdminNotifInbox } = await loadHooks();
    const result = useAdminNotifInbox();
    expect(result.isLoading).toBe(true);
  });

  it('returns isError true when tasks have error', async () => {
    mockUseAdminTasks.mockReturnValue(makeInfiniteQueryResult([], { isError: true }));

    const { useAdminNotifInbox } = await loadHooks();
    const result = useAdminNotifInbox();
    expect(result.isError).toBe(true);
  });

  it('returns isError true when redemptions have error', async () => {
    mockUseAdminRedemptions.mockReturnValue(makeInfiniteQueryResult([], { isError: true }));

    const { useAdminNotifInbox } = await loadHooks();
    const result = useAdminNotifInbox();
    expect(result.isError).toBe(true);
  });

  it('handles undefined data gracefully', async () => {
    mockUseAdminTasks.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    mockUseAdminRedemptions.mockReturnValue({ data: undefined, isLoading: false, isError: false });

    const { useAdminNotifInbox } = await loadHooks();
    const result = useAdminNotifInbox();
    expect(result.items).toEqual([]);
    expect(mockDeriveAdminNotifs).toHaveBeenCalledWith({ tasks: [], redemptions: [] });
  });
});

describe('useAdminUnreadNotifCount', () => {
  it('returns sum of pending validations and pending redemptions', async () => {
    mockUsePendingValidationCount.mockReturnValue(makeQueryResult(3));
    mockUsePendingRedemptionCount.mockReturnValue(makeQueryResult(2));

    const { useAdminUnreadNotifCount } = await loadHooks();
    const count = useAdminUnreadNotifCount();
    expect(count).toBe(5);
  });

  it('returns 0 when both counts are undefined', async () => {
    mockUsePendingValidationCount.mockReturnValue(makeQueryResult(undefined));
    mockUsePendingRedemptionCount.mockReturnValue(makeQueryResult(undefined));

    const { useAdminUnreadNotifCount } = await loadHooks();
    const count = useAdminUnreadNotifCount();
    expect(count).toBe(0);
  });
});

describe('useChildNotifInbox', () => {
  it('returns empty items when no assignments or redemptions', async () => {
    const { useChildNotifInbox } = await loadHooks();
    const result = useChildNotifInbox();
    expect(result.items).toEqual([]);
    expect(result.isLoading).toBe(false);
    expect(result.isError).toBe(false);
  });

  it('passes assignments and redemptions to deriveChildNotifs', async () => {
    const assignments = [{ id: '1', status: 'aprovada' }];
    const redemptions = [{ id: '2', status: 'confirmado' }];
    mockUseChildAssignments.mockReturnValue(makeInfiniteQueryResult(assignments));
    mockUseChildRedemptions.mockReturnValue(makeInfiniteQueryResult(redemptions));

    const { useChildNotifInbox } = await loadHooks();
    useChildNotifInbox();

    expect(mockDeriveChildNotifs).toHaveBeenCalledWith({
      assignments,
      redemptions,
      transactions: [],
    });
  });

  it('returns isLoading true when assignments are loading', async () => {
    mockUseChildAssignments.mockReturnValue(
      makeInfiniteQueryResult(undefined, { isLoading: true }),
    );

    const { useChildNotifInbox } = await loadHooks();
    const result = useChildNotifInbox();
    expect(result.isLoading).toBe(true);
  });

  it('returns isError true when redemptions have error', async () => {
    mockUseChildRedemptions.mockReturnValue(makeInfiniteQueryResult([], { isError: true }));

    const { useChildNotifInbox } = await loadHooks();
    const result = useChildNotifInbox();
    expect(result.isError).toBe(true);
  });

  it('handles undefined data gracefully', async () => {
    mockUseChildAssignments.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    mockUseChildRedemptions.mockReturnValue({ data: undefined, isLoading: false, isError: false });

    const { useChildNotifInbox } = await loadHooks();
    const result = useChildNotifInbox();
    expect(result.items).toEqual([]);
    expect(mockDeriveChildNotifs).toHaveBeenCalledWith({
      assignments: [],
      redemptions: [],
      transactions: [],
    });
  });
});

describe('useChildUnreadNotifCount', () => {
  it('returns count of items in Hoje group', async () => {
    const todayNotifs = [
      { id: '1', group: 'Hoje' },
      { id: '2', group: 'Hoje' },
      { id: '3', group: 'Ontem' },
    ] as any;
    mockDeriveChildNotifs.mockReturnValue(todayNotifs);

    const { useChildUnreadNotifCount } = await loadHooks();
    const count = useChildUnreadNotifCount();
    expect(count).toBe(2);
  });

  it('returns 0 when loading', async () => {
    mockUseChildAssignments.mockReturnValue(
      makeInfiniteQueryResult(undefined, { isLoading: true }),
    );

    const { useChildUnreadNotifCount } = await loadHooks();
    const count = useChildUnreadNotifCount();
    expect(count).toBe(0);
  });

  it('returns 0 when no items in Hoje group', async () => {
    mockDeriveChildNotifs.mockReturnValue([
      { id: '1', group: 'Ontem' },
      { id: '2', group: 'Anterior' },
    ] as any);

    const { useChildUnreadNotifCount } = await loadHooks();
    const count = useChildUnreadNotifCount();
    expect(count).toBe(0);
  });

  it('handles undefined data gracefully', async () => {
    mockUseChildAssignments.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    mockUseChildRedemptions.mockReturnValue({ data: undefined, isLoading: false, isError: false });

    const { useChildUnreadNotifCount } = await loadHooks();
    const count = useChildUnreadNotifCount();
    expect(count).toBe(0);
  });
});
