import { describe, expect, it, vi, beforeEach } from 'vitest';

const useChildAssignmentsMock = vi.fn();
const usePendingValidationCountMock = vi.fn();
const usePendingRedemptionCountMock = vi.fn();
const useImpersonationMock = vi.fn();

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return { ...actual, useMemo: (fn: () => unknown) => fn() };
});

vi.mock('@/hooks/queries', () => ({
  useChildAssignments: (childId?: string) => useChildAssignmentsMock(childId),
  usePendingValidationCount: () => usePendingValidationCountMock(),
  usePendingRedemptionCount: () => usePendingRedemptionCountMock(),
}));

vi.mock('@/context/impersonation-context', () => ({
  useImpersonation: () => useImpersonationMock(),
}));

vi.mock('@lib/tasks', () => ({
  getAssignmentRetryState: (a: { status: string; tentativas: number }) => ({
    canRetry: a.status === 'rejeitada' && a.tentativas < 1,
  }),
}));

const loadHooks = () => import('../use-footer-items');

describe('useChildFooterItems', () => {
  beforeEach(() => {
    useChildAssignmentsMock.mockReset();
    usePendingValidationCountMock.mockReset();
    usePendingRedemptionCountMock.mockReset();
    useImpersonationMock.mockReset().mockReturnValue({ impersonating: null });
  });

  it('returns 5 footer items with correct labels and routes', async () => {
    useChildAssignmentsMock.mockReturnValue({ data: undefined });
    const { useChildFooterItems } = await loadHooks();
    const items = useChildFooterItems();

    expect(items).toHaveLength(5);
    expect(items.map((i) => i.label)).toEqual([
      'Início',
      'Tarefas',
      'Prêmios',
      'Resgates',
      'Perfil',
    ]);
    expect(items.map((i) => i.rota)).toEqual([
      'index',
      '/(child)/tasks',
      '/(child)/prizes',
      '/(child)/redemptions',
      '/(child)/perfil',
    ]);
  });

  it('sets badge on tasks route with count of pending + retryable rejected assignments', async () => {
    useChildAssignmentsMock.mockReturnValue({
      data: {
        pages: [
          {
            data: [
              { status: 'pendente', tentativas: 0 },
              { status: 'rejeitada', tentativas: 0 }, // canRetry = true
              { status: 'rejeitada', tentativas: 1 }, // canRetry = false (used all attempts)
              { status: 'aprovada', tentativas: 0 },
              { status: 'aguardando_validacao', tentativas: 0 },
            ],
          },
        ],
      },
    });

    const { useChildFooterItems } = await loadHooks();
    const items = useChildFooterItems();
    const tasksItem = items.find((i) => i.rota === '/(child)/tasks');

    // 1 pendente + 1 rejeitada with canRetry = 2
    expect(tasksItem?.badge).toBe(2);
  });

  it('sets badge to 0 when no pending or retryable assignments', async () => {
    useChildAssignmentsMock.mockReturnValue({
      data: {
        pages: [
          {
            data: [
              { status: 'aprovada', tentativas: 0 },
              { status: 'rejeitada', tentativas: 1 }, // canRetry = false
            ],
          },
        ],
      },
    });

    const { useChildFooterItems } = await loadHooks();
    const items = useChildFooterItems();
    const tasksItem = items.find((i) => i.rota === '/(child)/tasks');

    expect(tasksItem?.badge).toBe(0);
  });

  it('handles undefined data gracefully', async () => {
    useChildAssignmentsMock.mockReturnValue({ data: undefined });

    const { useChildFooterItems } = await loadHooks();
    const items = useChildFooterItems();
    const tasksItem = items.find((i) => i.rota === '/(child)/tasks');

    expect(tasksItem?.badge).toBe(0);
  });

  it('scopes child task badge query while impersonating', async () => {
    useImpersonationMock.mockReturnValue({
      impersonating: { childId: 'child-1', childName: 'Lia' },
    });
    useChildAssignmentsMock.mockReturnValue({ data: undefined });

    const { useChildFooterItems } = await loadHooks();
    useChildFooterItems();

    expect(useChildAssignmentsMock).toHaveBeenCalledWith('child-1');
  });

  it('does not set badge on non-tasks routes', async () => {
    useChildAssignmentsMock.mockReturnValue({
      data: { pages: [{ data: [{ status: 'pendente', tentativas: 0 }] }] },
    });

    const { useChildFooterItems } = await loadHooks();
    const items = useChildFooterItems();

    for (const item of items) {
      if (item.rota !== '/(child)/tasks') {
        expect(item.badge).toBeUndefined();
      }
    }
  });
});

describe('useAdminFooterItems', () => {
  beforeEach(() => {
    usePendingValidationCountMock.mockReset();
    usePendingRedemptionCountMock.mockReset();
  });

  it('returns 5 footer items with correct labels and routes', async () => {
    usePendingValidationCountMock.mockReturnValue({ data: 0 });
    usePendingRedemptionCountMock.mockReturnValue({ data: 0 });

    const { useAdminFooterItems } = await loadHooks();
    const items = useAdminFooterItems();

    expect(items).toHaveLength(5);
    expect(items.map((i) => i.label)).toEqual([
      'Início',
      'Tarefas',
      'Prêmios',
      'Resgates',
      'Perfil',
    ]);
    expect(items.map((i) => i.rota)).toEqual([
      'index',
      '/(admin)/tasks',
      '/(admin)/prizes',
      '/(admin)/redemptions',
      '/(admin)/perfil',
    ]);
  });

  it('sets badge on tasks route with pending validation count', async () => {
    usePendingValidationCountMock.mockReturnValue({ data: 5 });
    usePendingRedemptionCountMock.mockReturnValue({ data: 0 });

    const { useAdminFooterItems } = await loadHooks();
    const items = useAdminFooterItems();
    const tasksItem = items.find((i) => i.rota === '/(admin)/tasks');

    expect(tasksItem?.badge).toBe(5);
  });

  it('sets badge on redemptions route with pending redemption count', async () => {
    usePendingValidationCountMock.mockReturnValue({ data: 0 });
    usePendingRedemptionCountMock.mockReturnValue({ data: 3 });

    const { useAdminFooterItems } = await loadHooks();
    const items = useAdminFooterItems();
    const redemptionsItem = items.find((i) => i.rota === '/(admin)/redemptions');

    expect(redemptionsItem?.badge).toBe(3);
  });

  it('defaults to 0 when query data is null', async () => {
    usePendingValidationCountMock.mockReturnValue({ data: null });
    usePendingRedemptionCountMock.mockReturnValue({ data: null });

    const { useAdminFooterItems } = await loadHooks();
    const items = useAdminFooterItems();

    expect(items.find((i) => i.rota === '/(admin)/tasks')?.badge).toBe(0);
    expect(items.find((i) => i.rota === '/(admin)/redemptions')?.badge).toBe(0);
  });

  it('does not set badge on non-tasks/non-redemptions routes', async () => {
    usePendingValidationCountMock.mockReturnValue({ data: 10 });
    usePendingRedemptionCountMock.mockReturnValue({ data: 10 });

    const { useAdminFooterItems } = await loadHooks();
    const items = useAdminFooterItems();

    const otherItems = items.filter(
      (i) => i.rota !== '/(admin)/tasks' && i.rota !== '/(admin)/redemptions',
    );
    for (const item of otherItems) {
      expect(item.badge).toBeUndefined();
    }
  });
});
