import React from 'react';
import { act, create, type ReactTestRenderer } from '../helpers/test-renderer-compat';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FilhoHomeScreen from '../../app/(child)/index';

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
}));

const profileMock = vi.hoisted(() => ({
  data: { id: 'u1', nome: 'João', familia_id: 'fam-1', papel: 'filho' } as
    | Record<string, unknown>
    | undefined,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
}));

const familyMock = vi.hoisted(() => ({
  data: { id: 'fam-1', nome: 'Silva' } as Record<string, unknown> | null,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
}));

const assignmentsMock = vi.hoisted(() => ({
  data: {
    pages: [
      {
        data: [
          { id: 'a1', status: 'pendente', titulo_snapshot: 'Arrumar quarto', pontos_snapshot: 10, exige_evidencia_snapshot: false, tentativas: 0, tarefas: { dias_semana: 127, ativo: true } },
          { id: 'a2', status: 'pendente', titulo_snapshot: 'Lavar louça', pontos_snapshot: 15, exige_evidencia_snapshot: true, tentativas: 0, tarefas: { dias_semana: 127, ativo: true } },
          { id: 'a3', status: 'aprovada', titulo_snapshot: 'Fazer lição', pontos_snapshot: 20, exige_evidencia_snapshot: false, tentativas: 0, tarefas: { dias_semana: 127, ativo: true } },
        ],
      },
    ],
  } as Record<string, unknown> | undefined,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
}));

const balanceMock = vi.hoisted(() => ({
  data: { saldo_livre: 150, cofrinho: 30 } as Record<string, unknown> | null,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
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
  AppState: { addEventListener: () => ({ remove: vi.fn() }) },
  Pressable: createHostComponent('Pressable'),
  RefreshControl: createHostComponent('RefreshControl'),
  ScrollView: createHostComponent('ScrollView'),
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: createHostComponent('Text'),
  View: createHostComponent('View'),
}));

vi.mock('expo-status-bar', () => ({
  StatusBar: createHostComponent('StatusBar'),
}));

vi.mock('expo-image', () => ({
  Image: createHostComponent('Image'),
}));

vi.mock('expo-router', () => ({
  useRouter: () => routerMock,
}));

vi.mock('lucide-react-native', () => ({
  ClipboardList: (props: Record<string, unknown>) => React.createElement('ClipboardList', props),
  Gift: (props: Record<string, unknown>) => React.createElement('Gift', props),
  House: (props: Record<string, unknown>) => React.createElement('House', props),
  ShoppingBag: (props: Record<string, unknown>) => React.createElement('ShoppingBag', props),
  PiggyBank: (props: Record<string, unknown>) => React.createElement('PiggyBank', props),
  Pencil: (props: Record<string, unknown>) => React.createElement('Pencil', props),
  Bell: (props: Record<string, unknown>) => React.createElement('Bell', props),
  User: (props: Record<string, unknown>) => React.createElement('User', props),
  CheckCircle2: (props: Record<string, unknown>) => React.createElement('CheckCircle2', props),
  Clock: (props: Record<string, unknown>) => React.createElement('Clock', props),
  ChevronRight: (props: Record<string, unknown>) => React.createElement('ChevronRight', props),
  Wallet: (props: Record<string, unknown>) => React.createElement('Wallet', props),
  AlertTriangle: (props: Record<string, unknown>) => React.createElement('AlertTriangle', props),
  Camera: (props: Record<string, unknown>) => React.createElement('Camera', props),
  Send: (props: Record<string, unknown>) => React.createElement('Send', props),
  RotateCcw: (props: Record<string, unknown>) => React.createElement('RotateCcw', props),
}));

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: createHostComponent('LinearGradient'),
}));

vi.mock('@/constants/shadows', () => ({
  gradients: {
    heroNavy: { colors: ['#0F1729', '#19233F', '#283B5D'], locations: [0, 0.6, 1], start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } },
  },
  heroPalette: {
    textOnNavy: '#FFFFFF',
    textOnNavyMuted: 'rgba(255, 255, 255, 0.70)',
    textOnNavySubtle: 'rgba(255, 255, 255, 0.55)',
  },
}));

vi.mock('@lib/tasks', () => ({
  getAssignmentPoints: (a: Record<string, unknown>) => a.pontos_snapshot ?? a.pontos ?? 10,
  getAssignmentRetryState: (a: Record<string, unknown>) => ({
    canRetry: a.status === 'rejeitada',
    attemptsLeft: a.status === 'rejeitada' ? 1 : 0,
    reason: null,
  }),
  formatWeekdays: () => 'Todos os dias',
}));

vi.mock('@/components/tasks/task-points-pill', () => ({
  TaskPointsPill: (props: Record<string, unknown>) => React.createElement('TaskPointsPill', props),
}));

vi.mock('@sentry/react-native', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock('@lib/utils', () => ({
  getGreeting: () => 'Bom dia',
}));

vi.mock('@lib/notifications', () => ({
  isNotificationPermissionDenied: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/hooks/use-notification-inbox', () => ({
  useChildUnreadNotifCount: () => 0,
}));

vi.mock('@/hooks/queries', () => ({
  useProfile: () => profileMock,
  useFamily: () => familyMock,
  useChildAssignments: () => assignmentsMock,
  useBalance: () => balanceMock,
  useRenewRecurringTasks: vi.fn(),
  combineQueryStates: (...queries: Record<string, unknown>[]) => ({
    isLoading: queries.some((q) => q.isLoading),
    error: queries.find((q) => q.error)?.error ?? null,
    refetchAll: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/constants/colors', () => ({
  darkColors: {
    bg: { surface: '#1D212B', elevated: '#2A303C' },
  },
}));

vi.mock('@/components/ui/notification-permission-banner', () => ({
  NotificationPermissionBanner: () => React.createElement('NotificationPermissionBanner'),
}));

vi.mock('@/components/ui/safe-screen-frame', () => ({
  SafeScreenFrame: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('SafeScreenFrame', null, children),
}));

vi.mock('@/components/ui/inline-message', () => ({
  InlineMessage: (props: Record<string, unknown>) => React.createElement('InlineMessage', props),
}));

vi.mock('@/components/ui/skeleton', () => ({
  HomeScreenSkeleton: () => React.createElement('HomeScreenSkeleton'),
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: (props: Record<string, unknown>) => React.createElement('Avatar', props),
}));

vi.mock('@/components/ui/home-footer-bar', () => ({
  FOOTER_BAR_HEIGHT: 56,
  HomeFooterBar: ({
    items,
    onNavigate,
  }: {
    items: { label: string; rota: string; badge?: number }[];
    onNavigate: (rota: string) => void;
  }) =>
    React.createElement(
      'HomeFooterBar',
      null,
      ...items.map((item) =>
        React.createElement(
          'Pressable',
          { key: item.rota, accessibilityLabel: item.label, onPress: () => onNavigate(item.rota) },
          React.createElement('Text', null, item.label),
          item.badge ? React.createElement('Text', null, String(item.badge)) : null,
        ),
      ),
    ),
}));

vi.mock('@/context/theme-context', () => ({
  useTheme: () => ({
    colors: {
      statusBar: 'dark',
      bg: { canvas: '#fff', surface: '#fff', muted: '#f0f0f0', elevated: '#f5f5f5' },
      text: { primary: '#000', secondary: '#666', muted: '#999', inverse: '#fff', onBrand: '#000' },
      accent: { filho: '#3366CC', filhoBg: '#EEF', filhoDim: '#C57B0D' },
      border: { subtle: '#eee' },
      brand: { vivid: '#FAC114' },
      semantic: { error: '#c00', errorBg: '#FDE7E7', success: '#0a0', successBg: '#e0ffe0', warning: '#fa0' },
    },
  }),
}));

vi.mock('@/context/impersonation-context', () => ({
  useImpersonation: () => ({ impersonating: null, startImpersonation: vi.fn(), stopImpersonation: vi.fn() }),
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

describe('FilhoHomeScreen', () => {
  beforeEach(() => {
    routerMock.push.mockReset();
    profileMock.data = { id: 'u1', nome: 'João', familia_id: 'fam-1', papel: 'filho' };
    profileMock.isLoading = false;
    familyMock.data = { id: 'fam-1', nome: 'Silva' };
    familyMock.isLoading = false;
    assignmentsMock.data = {
      pages: [
        {
          data: [
            { id: 'a1', status: 'pendente', titulo_snapshot: 'Arrumar quarto', pontos_snapshot: 10, exige_evidencia_snapshot: false, tentativas: 0, tarefas: { dias_semana: 127, ativo: true } },
            { id: 'a2', status: 'pendente', titulo_snapshot: 'Lavar louça', pontos_snapshot: 15, exige_evidencia_snapshot: true, tentativas: 0, tarefas: { dias_semana: 127, ativo: true } },
            { id: 'a3', status: 'aprovada', titulo_snapshot: 'Fazer lição', pontos_snapshot: 20, exige_evidencia_snapshot: false, tentativas: 0, tarefas: { dias_semana: 127, ativo: true } },
          ],
        },
      ],
    };
    assignmentsMock.isLoading = false;
    balanceMock.data = { saldo_livre: 150, cofrinho: 30 };
    balanceMock.isLoading = false;
  });

  it('shows skeleton when loading', () => {
    profileMock.isLoading = true;
    const renderer = render(<FilhoHomeScreen />);
    expect(renderer.root.findAllByType('HomeScreenSkeleton' as never).length).toBe(1);
  });

  it('renders greeting', () => {
    const renderer = render(<FilhoHomeScreen />);
    const text = allText(renderer);
    expect(text).toContain('Bom dia');
  });

  it('renders child name', () => {
    const renderer = render(<FilhoHomeScreen />);
    const text = allText(renderer);
    expect(text).toContain('Olá, João!');
  });

  it('renders pending tasks count in badge', () => {
    const renderer = render(<FilhoHomeScreen />);
    const text = allText(renderer);
    expect(text).toContain('2');
    expect(text).toContain('Tarefas');
  });

  it('renders balance summary card', () => {
    const renderer = render(<FilhoHomeScreen />);
    const text = allText(renderer);
    expect(text).toContain('MEUS PONTOS');
    expect(text).toContain('180');
    expect(text).toContain('LIVRE');
    expect(text).toContain('COFRINHO');
  });

  it('renders footer bar actions', () => {
    const renderer = render(<FilhoHomeScreen />);
    const text = allText(renderer);
    expect(text).toContain('Início');
    expect(text).toContain('Tarefas');
    expect(text).toContain('Prêmios');
    expect(text).toContain('Resgates');
    expect(text).toContain('Perfil');
  });

  it('navigates to tasks on footer action press', () => {
    const renderer = render(<FilhoHomeScreen />);
    const tarefasButton = renderer.root.findAll(
      (node) => node.props.accessibilityLabel === 'Tarefas',
    )[0];
    expect(tarefasButton).toBeDefined();
    act(() => {
      tarefasButton.props.onPress();
    });
    expect(routerMock.push).toHaveBeenCalledWith('/(child)/tasks');
  });

  it('navigates to balance on summary card press', () => {
    const renderer = render(<FilhoHomeScreen />);
    const pressables = renderer.root.findAllByType('Pressable' as never);
    const summaryCard = pressables.find((p) =>
      p.props.accessibilityLabel?.includes('ver detalhes'),
    );
    expect(summaryCard).toBeDefined();
    act(() => {
      summaryCard!.props.onPress();
    });
    expect(routerMock.push).toHaveBeenCalledWith('/(child)/balance');
  });

  it('shows zero balance hint when both balances are zero', () => {
    balanceMock.data = { saldo_livre: 0, cofrinho: 0 };
    const renderer = render(<FilhoHomeScreen />);
    const text = allText(renderer);
    expect(text).toContain('Complete tarefas para ganhar seus primeiros pontos');
  });
});
