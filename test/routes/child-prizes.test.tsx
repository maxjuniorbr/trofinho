import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ChildPrizesScreen from '../../app/(child)/prizes/index';

const routerMock = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
}));

const alertMock = vi.hoisted(() => ({
  alert: vi.fn(),
}));

const prizesMock = vi.hoisted(() => ({
  data: [
    { id: 'p1', nome: 'Bicicleta', descricao: 'MTB legal', custo_pontos: 100, imagem_url: null, ativo: true },
    { id: 'p2', nome: 'Livro', descricao: null, custo_pontos: 30, imagem_url: 'https://img.test/book.jpg', ativo: true },
  ] as Record<string, unknown>[] | undefined,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
}));

const balanceMock = vi.hoisted(() => ({
  data: { saldo_livre: 50 } as Record<string, unknown> | null,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
}));

const redeemMutationMock = vi.hoisted(() => ({
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending: false,
}));

const profileMock = vi.hoisted(() => ({
  data: { id: 'u1', nome: 'João', familia_id: 'fam-1' } as Record<string, unknown> | undefined,
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
  Alert: alertMock,
  Animated: {
    Value: class AnimatedValue {
      interpolate() {
        return '50%';
      }
    },
    timing: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
    View: createHostComponent('AnimatedView'),
  },
  Pressable: createHostComponent('Pressable'),
  RefreshControl: createHostComponent('RefreshControl'),
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

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: createHostComponent('LinearGradient'),
}));

vi.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data,
    renderItem,
    ListHeaderComponent,
    ...props
  }: {
    data: Record<string, unknown>[];
    renderItem: (info: { item: Record<string, unknown> }) => React.ReactNode;
    ListHeaderComponent?: React.ReactNode;
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
        : null,
    ),
}));

vi.mock('lucide-react-native', () => ({
  Trophy: (props: Record<string, unknown>) => React.createElement('Trophy', props),
  CheckCircle2: (props: Record<string, unknown>) => React.createElement('CheckCircle2', props),
  House: (props: Record<string, unknown>) => React.createElement('House', props),
  ClipboardList: (props: Record<string, unknown>) => React.createElement('ClipboardList', props),
  Gift: (props: Record<string, unknown>) => React.createElement('Gift', props),
  ShoppingBag: (props: Record<string, unknown>) => React.createElement('ShoppingBag', props),
  UserCircle: (props: Record<string, unknown>) => React.createElement('UserCircle', props),
}));

vi.mock('@sentry/react-native', () => ({
  captureException: vi.fn(),
}));

vi.mock('@lib/haptics', () => ({
  hapticSuccess: vi.fn(),
}));

vi.mock('@/hooks/queries', () => ({
  useActivePrizes: () => prizesMock,
  useBalance: () => balanceMock,
  useRequestRedemption: () => redeemMutationMock,
  useProfile: () => profileMock,
  combineQueryStates: (...queries: Record<string, unknown>[]) => ({
    isLoading: queries.some((q) => q.isLoading),
    error: queries.find((q) => q.error)?.error ?? null,
    refetchAll: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/hooks/use-footer-items', () => ({
  useChildFooterItems: () => [],
}));

vi.mock('@/components/ui/button', () => ({
  Button: (props: Record<string, unknown>) => React.createElement('Button', props),
}));

vi.mock('@/components/ui/empty-state', () => ({
  EmptyState: (props: Record<string, unknown>) => React.createElement('EmptyState', props),
}));

vi.mock('@/components/ui/inline-message', () => ({
  InlineMessage: (props: Record<string, unknown>) => React.createElement('InlineMessage', props),
}));

vi.mock('@/components/ui/screen-header', () => ({
  ScreenHeader: (props: Record<string, unknown>) => React.createElement('ScreenHeader', props),
}));

vi.mock('@/components/ui/safe-screen-frame', () => ({
  SafeScreenFrame: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('SafeScreenFrame', null, children),
}));

vi.mock('@/context/theme-context', () => ({
  useTheme: () => ({
    colors: {
      statusBar: 'dark',
      bg: { canvas: '#fff', surface: '#fff', muted: '#f0f0f0' },
      text: { primary: '#000', secondary: '#666', muted: '#999', inverse: '#fff', onBrand: '#fff', onBrandMuted: '#ccc' },
      accent: { filho: '#3366CC', filhoBg: '#EEF' },
      border: { subtle: '#eee' },
      brand: { vivid: '#000' },
      semantic: { success: '#0a0', successBg: '#e0ffe0', error: '#c00' },
    },
  }),
}));

vi.mock('@/components/ui/skeleton', () => ({
  ListScreenSkeleton: () => React.createElement('ListScreenSkeleton'),
}));

vi.mock('@/constants/theme', () => ({
  gradients: {
    goldHorizontal: { colors: ['#f0c', '#fc0'], start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
  },
  radii: { xl: 16, lg: 12, md: 8, inner: 8, full: 999 },
  shadows: { card: {}, goldGlow: {} },
  spacing: { '1': 4, '2': 8, '3': 12, '4': 16, '5': 20, '6': 24, '12': 48, screen: 16 },
  typography: {
    size: { xs: 12, sm: 14, md: 16, lg: 18, '2xl': 24, '3xl': 30 },
    family: { medium: 'medium', semibold: 'semibold', bold: 'bold', black: 'black' },
  },
}));

vi.mock('@/components/ui/home-footer-bar', () => ({
  FOOTER_BAR_HEIGHT: 56,
  HomeFooterBar: () => React.createElement('HomeFooterBar'),
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

describe('ChildPrizesScreen', () => {
  beforeEach(() => {
    routerMock.back.mockReset();
    alertMock.alert.mockReset();
    redeemMutationMock.mutateAsync.mockReset().mockResolvedValue(undefined);
    prizesMock.data = [
      { id: 'p1', nome: 'Bicicleta', descricao: 'MTB legal', custo_pontos: 100, imagem_url: null, ativo: true },
      { id: 'p2', nome: 'Livro', descricao: null, custo_pontos: 30, imagem_url: 'https://img.test/book.jpg', ativo: true },
    ];
    prizesMock.isLoading = false;
    prizesMock.error = null;
    balanceMock.data = { saldo_livre: 50 };
    balanceMock.isLoading = false;
    profileMock.data = { id: 'u1', nome: 'João', familia_id: 'fam-1' };
  });

  it('shows skeleton when loading', () => {
    prizesMock.isLoading = true;
    const renderer = render(<ChildPrizesScreen />);
    const skeleton = renderer.root.findByType('ListScreenSkeleton' as never);
    expect(skeleton).toBeDefined();
  });

  it('shows empty state when no prizes', () => {
    prizesMock.data = [];
    const renderer = render(<ChildPrizesScreen />);
    const empty = renderer.root.findByType('EmptyState' as never);
    expect(empty.props.empty).toBe(true);
  });

  it('renders prize names', () => {
    const renderer = render(<ChildPrizesScreen />);
    const text = allText(renderer);
    expect(text).toContain('Bicicleta');
    expect(text).toContain('Livro');
  });

  it('renders prize costs', () => {
    const renderer = render(<ChildPrizesScreen />);
    const text = allText(renderer);
    expect(text).toContain('100 pts');
    expect(text).toContain('30 pts');
  });

  it('renders balance banner', () => {
    const renderer = render(<ChildPrizesScreen />);
    const text = allText(renderer);
    expect(text).toContain('Saldo disponível');
    expect(text).toContain('50');
  });

  it('shows "Disponível!" for affordable prize', () => {
    const renderer = render(<ChildPrizesScreen />);
    const text = allText(renderer);
    expect(text).toContain('Disponível!');
  });

  it('shows remaining points for unaffordable prize', () => {
    const renderer = render(<ChildPrizesScreen />);
    const text = allText(renderer);
    expect(text).toContain('Faltam 50 pts');
  });

  it('shows alert when redeem button pressed', () => {
    const renderer = render(<ChildPrizesScreen />);
    const buttons = renderer.root.findAllByType('Button' as never);
    const redeemBtn = buttons.find((b) => b.props.label === 'Resgatar');
    expect(redeemBtn).toBeDefined();
    act(() => {
      redeemBtn!.props.onPress();
    });
    expect(alertMock.alert).toHaveBeenCalledWith(
      'Confirmar resgate',
      expect.any(String),
      expect.any(Array),
    );
  });

  it('renders screen header', () => {
    const renderer = render(<ChildPrizesScreen />);
    const header = renderer.root.findByType('ScreenHeader' as never);
    expect(header.props.title).toBe('Meus Prêmios');
    expect(header.props.role).toBe('filho');
  });

  it('renders prize description when available', () => {
    const renderer = render(<ChildPrizesScreen />);
    const text = allText(renderer);
    expect(text).toContain('MTB legal');
  });
});
