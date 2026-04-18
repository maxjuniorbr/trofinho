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
          { id: 'a1', status: 'pendente' },
          { id: 'a2', status: 'pendente' },
          { id: 'a3', status: 'concluida' },
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
}));

vi.mock('@sentry/react-native', () => ({
  captureException: vi.fn(),
}));

vi.mock('@lib/utils', () => ({
  getGreeting: () => 'Bom dia',
}));

vi.mock('@lib/notifications', () => ({
  isNotificationPermissionDenied: vi.fn().mockResolvedValue(false),
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

vi.mock('@/constants/assets', () => ({
  mascotImage: 'mascot.png',
  celebratingImage: 'celebrating.png',
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
      text: { primary: '#000', secondary: '#666', muted: '#999', inverse: '#fff' },
      accent: { filho: '#3366CC', filhoBg: '#EEF', filhoDim: '#C57B0D' },
      border: { subtle: '#eee' },
      brand: { vivid: '#000' },
      semantic: { error: '#c00' },
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
            { id: 'a1', status: 'pendente' },
            { id: 'a2', status: 'pendente' },
            { id: 'a3', status: 'concluida' },
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

  it('renders edit badge on avatar', () => {
    const renderer = render(<FilhoHomeScreen />);
    const pencils = renderer.root.findAllByType('Pencil' as never);
    expect(pencils.length).toBeGreaterThan(0);
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
    expect(text).toContain('MEU SALDO');
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

  it('shows mascot image', () => {
    const renderer = render(<FilhoHomeScreen />);
    const images = renderer.root.findAllByType('Image' as never);
    expect(images.length).toBeGreaterThan(0);
  });

  it('shows zero balance hint when both balances are zero', () => {
    balanceMock.data = { saldo_livre: 0, cofrinho: 0 };
    const renderer = render(<FilhoHomeScreen />);
    const text = allText(renderer);
    expect(text).toContain('Complete tarefas para ganhar seus primeiros pontos!');
  });

  it('shows celebrating mascot when no pending tasks', () => {
    assignmentsMock.data = {
      pages: [{ data: [{ id: 'a1', status: 'concluida' }] }],
    };
    const renderer = render(<FilhoHomeScreen />);
    const images = renderer.root.findAllByType('Image' as never);
    const mascot = images.find((img) => img.props.accessibilityLabel === 'Trofinho celebrando');
    expect(mascot).toBeDefined();
  });
});
