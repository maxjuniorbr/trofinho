import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ChildBalanceScreen from '../../app/(child)/balance';

const routerMock = vi.hoisted(() => ({
  back: vi.fn(),
}));

const profileMock = vi.hoisted(() => ({
  data: { id: 'u1', nome: 'João', familia_id: 'fam-1', papel: 'filho' } as Record<string, unknown> | undefined,
}));

const childIdMock = vi.hoisted(() => ({
  data: 'child-1' as string | null,
  isError: false,
}));

const balanceMock = vi.hoisted(() => ({
  data: {
    saldo_livre: 200,
    cofrinho: 80,
    indice_valorizacao: 5,
    periodo_valorizacao: 'semanal',
    proxima_valorizacao_em: '2025-07-01',
    taxa_resgate_cofrinho: 10,
  } as Record<string, unknown> | null,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
}));

const transactionsMock = vi.hoisted(() => ({
  data: {
    pages: [
      {
        data: [
          { id: 't1', tipo: 'credito_tarefa', descricao: 'Tarefa concluída', valor: 50, created_at: '2025-06-01' },
          { id: 't2', tipo: 'debito_resgate', descricao: 'Resgate prêmio', valor: 30, created_at: '2025-06-02' },
        ],
      },
    ],
  } as Record<string, unknown> | undefined,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
  fetchNextPage: vi.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
}));

const transferMutationMock = vi.hoisted(() => ({
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending: false,
}));

const withdrawalMutationMock = vi.hoisted(() => ({
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending: false,
}));

const cancelWithdrawalMutationMock = vi.hoisted(() => ({
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending: false,
}));

const pendingWithdrawalMock = vi.hoisted(() => ({
  data: null as Record<string, unknown> | null,
}));

const createHostComponent = vi.hoisted(() => {
  return (name: string) =>
    React.forwardRef(function HostComponent(
      props: Record<string, unknown> & { children?: React.ReactNode },
      ref: React.ForwardedRef<unknown>,
    ) {
      return React.createElement(name, { ...props, ref }, props.children);
    });
});

vi.mock('react-native', () => ({
  ActivityIndicator: createHostComponent('ActivityIndicator'),
  KeyboardAvoidingView: createHostComponent('KeyboardAvoidingView'),
  Modal: createHostComponent('Modal'),
  Pressable: createHostComponent('Pressable'),
  RefreshControl: createHostComponent('RefreshControl'),
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: createHostComponent('Text'),
  TextInput: createHostComponent('TextInput'),
  View: createHostComponent('View'),
}));

vi.mock('expo-status-bar', () => ({
  StatusBar: createHostComponent('StatusBar'),
}));

vi.mock('expo-router', () => ({
  useRouter: () => routerMock,
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));

vi.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data,
    renderItem,
    ListHeaderComponent,
    ListEmptyComponent,
    ListFooterComponent,
    ...props
  }: {
    data: Record<string, unknown>[];
    renderItem: (info: { item: Record<string, unknown> }) => React.ReactNode;
    ListHeaderComponent?: React.ReactNode;
    ListEmptyComponent?: React.ReactNode;
    ListFooterComponent?: React.ReactNode;
    [key: string]: unknown;
  }) =>
    React.createElement(
      'FlashList',
      props,
      ListHeaderComponent,
      data && data.length > 0
        ? data.map((item) =>
            React.createElement(React.Fragment, { key: item.id as string }, renderItem({ item })),
          )
        : ListEmptyComponent,
      ListFooterComponent,
    ),
}));

vi.mock('lucide-react-native', () => ({
  Wallet: (props: Record<string, unknown>) => React.createElement('Wallet', props),
  TrendingUp: (props: Record<string, unknown>) => React.createElement('TrendingUp', props),
}));

vi.mock('@sentry/react-native', () => ({
  captureException: vi.fn(),
}));

vi.mock('@lib/haptics', () => ({
  hapticSuccess: vi.fn(),
}));

vi.mock('@lib/utils', () => ({
  formatDate: (d: string) => d,
}));

vi.mock('@lib/balances', () => ({
  getAppreciationPeriodLabel: (s: string) => s,
  getTransactionTypeLabel: (t: string) => t,
  isCredit: (t: string) => t.startsWith('credito'),
}));

vi.mock('@lib/safe-area', () => ({
  getSafeBottomPadding: () => 34,
}));

vi.mock('@/hooks/queries', () => ({
  useProfile: () => profileMock,
  useMyChildId: () => childIdMock,
  useBalance: () => balanceMock,
  useTransactions: () => transactionsMock,
  useTransferToPiggyBank: () => transferMutationMock,
  useChildPendingWithdrawal: () => pendingWithdrawalMock,
  useRequestPiggyBankWithdrawal: () => withdrawalMutationMock,
  useCancelPiggyBankWithdrawal: () => cancelWithdrawalMutationMock,
  combineQueryStates: (...queries: Record<string, unknown>[]) => ({
    isLoading: queries.some((q) => q.isLoading),
    error: queries.find((q) => q.error)?.error ?? null,
    refetchAll: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/hooks/use-transient-message', () => ({
  useTransientMessage: (msg: string | null) => msg,
}));

vi.mock('@/components/ui/button', () => ({
  Button: (props: Record<string, unknown>) => React.createElement('Button', props),
}));

vi.mock('@/components/ui/empty-state', () => ({
  EmptyState: (props: Record<string, unknown>) => React.createElement('EmptyState', props),
}));

vi.mock('@/components/ui/screen-header', () => ({
  ScreenHeader: (props: Record<string, unknown>) => React.createElement('ScreenHeader', props),
}));

vi.mock('@/components/ui/safe-screen-frame', () => ({
  SafeScreenFrame: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('SafeScreenFrame', null, children),
}));

vi.mock('@/components/balance/transaction-icon', () => ({
  TransactionIcon: (props: Record<string, unknown>) => React.createElement('TransactionIcon', props),
}));

vi.mock('@/components/ui/points-display', () => ({
  PointsDisplay: (props: Record<string, unknown>) => React.createElement('PointsDisplay', props),
}));

vi.mock('@/components/ui/inline-message', () => ({
  InlineMessage: (props: Record<string, unknown>) => React.createElement('InlineMessage', props),
}));

vi.mock('@/components/ui/list-footer', () => ({
  ListFooter: (props: Record<string, unknown>) => React.createElement('ListFooter', props),
}));

vi.mock('@/context/theme-context', () => ({
  useTheme: () => ({
    colors: {
      statusBar: 'dark',
      bg: { canvas: '#fff', surface: '#fff', elevated: '#fafafa', muted: '#f0f0f0' },
      text: { primary: '#000', secondary: '#666', muted: '#999', inverse: '#fff', onBrandMuted: '#ccc', onBrand: '#fff' },
      accent: { filho: '#3366CC', filhoBg: '#EEF' },
      border: { default: '#ddd', subtle: '#eee' },
      brand: { vivid: '#000' },
      semantic: { success: '#0a0', successBg: '#e0ffe0', error: '#c00' },
      overlay: { scrimSoft: 'rgba(0,0,0,0.3)' },
    },
  }),
}));

function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

function allText(renderer: ReactTestRenderer): string {
  return renderer.root
    .findAll((node) => (node.type as string) === 'Text')
    .map((node) => {
      const children = node.props.children;
      if (typeof children === 'string') return children;
      if (typeof children === 'number') return String(children);
      if (Array.isArray(children))
        return children
          .filter((c) => typeof c === 'string' || typeof c === 'number')
          .map(String)
          .join('');
      return '';
    })
    .join(' ');
}

describe('ChildBalanceScreen', () => {
  beforeEach(() => {
    routerMock.back.mockReset();
    profileMock.data = { id: 'u1', nome: 'João', familia_id: 'fam-1', papel: 'filho' };
    childIdMock.data = 'child-1';
    childIdMock.isError = false;
    balanceMock.data = {
      saldo_livre: 200,
      cofrinho: 80,
      indice_valorizacao: 5,
      periodo_valorizacao: 'semanal',
      proxima_valorizacao_em: '2025-07-01',
      taxa_resgate_cofrinho: 10,
    };
    balanceMock.isLoading = false;
    transactionsMock.data = {
      pages: [
        {
          data: [
            { id: 't1', tipo: 'credito_tarefa', descricao: 'Tarefa concluída', valor: 50, created_at: '2025-06-01' },
            { id: 't2', tipo: 'debito_resgate', descricao: 'Resgate prêmio', valor: 30, created_at: '2025-06-02' },
          ],
        },
      ],
    };
    transactionsMock.isLoading = false;
    transferMutationMock.mutateAsync.mockReset().mockResolvedValue(undefined);
    withdrawalMutationMock.mutateAsync.mockReset().mockResolvedValue(undefined);
    cancelWithdrawalMutationMock.mutateAsync.mockReset().mockResolvedValue(undefined);
    pendingWithdrawalMock.data = null;
  });

  it('shows loading state', () => {
    balanceMock.isLoading = true;
    const renderer = render(<ChildBalanceScreen />);
    const indicators = renderer.root.findAllByType('ActivityIndicator' as never);
    expect(indicators.length).toBeGreaterThan(0);
  });

  it('shows error state when childId fails', () => {
    childIdMock.isError = true;
    const renderer = render(<ChildBalanceScreen />);
    const empty = renderer.root.findByType('EmptyState' as never);
    expect(empty.props.error).toBeTruthy();
  });

  it('renders balance cards', () => {
    const renderer = render(<ChildBalanceScreen />);
    const points = renderer.root.findAllByType('PointsDisplay' as never);
    expect(points.length).toBe(2);
    expect(points[0].props.value).toBe(200);
    expect(points[1].props.value).toBe(80);
  });

  it('renders appreciation info', () => {
    const renderer = render(<ChildBalanceScreen />);
    const text = allText(renderer);
    expect(text).toContain('5%');
    expect(text).toContain('ao mês');
  });

  it('renders transaction list', () => {
    const renderer = render(<ChildBalanceScreen />);
    const text = allText(renderer);
    expect(text).toContain('Tarefa concluída');
    expect(text).toContain('Resgate prêmio');
  });

  it('renders piggy bank transfer button', () => {
    const renderer = render(<ChildBalanceScreen />);
    const buttons = renderer.root.findAllByType('Button' as never);
    const piggyBtn = buttons.find((b) => b.props.label === 'Guardar no cofrinho');
    expect(piggyBtn).toBeDefined();
  });

  it('disables transfer button when balance is zero', () => {
    balanceMock.data = { saldo_livre: 0, cofrinho: 0, indice_valorizacao: 0, periodo_valorizacao: 'mensal', proxima_valorizacao_em: null };
    const renderer = render(<ChildBalanceScreen />);
    const buttons = renderer.root.findAllByType('Button' as never);
    const piggyBtn = buttons.find((b) => b.props.label === 'Guardar no cofrinho');
    expect(piggyBtn?.props.disabled).toBe(true);
  });

  it('renders screen header with correct title', () => {
    const renderer = render(<ChildBalanceScreen />);
    const header = renderer.root.findByType('ScreenHeader' as never);
    expect(header.props.title).toBe('Meu Saldo');
  });

  it('shows Histórico section', () => {
    const renderer = render(<ChildBalanceScreen />);
    const text = allText(renderer);
    expect(text).toContain('Histórico');
  });
});
