import React from 'react';
import { act, create, type ReactTestRenderer } from '../helpers/test-renderer-compat';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminNotificationsScreen from '../../app/(admin)/notifications';
import type { Notif } from '@lib/notification-inbox';

// ── Hoisted mocks ────────────────────────────────────────

const routerMock = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
}));

const inboxMock = vi.hoisted(() => ({
  items: [] as Notif[],
  isLoading: false,
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

// ── Module mocks ─────────────────────────────────────────

vi.mock('react-native', () => ({
  ActivityIndicator: createHostComponent('ActivityIndicator'),
  Pressable: createHostComponent('Pressable'),
  ScrollView: createHostComponent('ScrollView'),
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: createHostComponent('Text'),
  View: createHostComponent('View'),
}));

vi.mock('expo-router', () => ({
  useRouter: () => routerMock,
}));

vi.mock('lucide-react-native', () => ({
  BellOff: createHostComponent('BellOff'),
  ClipboardCheck: createHostComponent('ClipboardCheck'),
  ShoppingBag: createHostComponent('ShoppingBag'),
  AlertTriangle: createHostComponent('AlertTriangle'),
  TrendingUp: createHostComponent('TrendingUp'),
}));

vi.mock('@/hooks/use-notification-inbox', () => ({
  useAdminNotifInbox: () => inboxMock,
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
      bg: { canvas: '#fff', surface: '#fff', muted: '#eee' },
      text: { primary: '#000', secondary: '#666', muted: '#999', onBrand: '#fff' },
      accent: { admin: '#3366CC', adminBg: '#e8f0fe', adminDim: '#1a4db0' },
      border: { default: '#ddd' },
      semantic: {
        info: '#3366CC',
        infoBg: '#e8f0fe',
        warning: '#f59e0b',
        warningBg: '#fef3c7',
        error: '#ef4444',
        errorBg: '#fee2e2',
        success: '#22c55e',
        successBg: '#dcfce7',
      },
    },
  }),
}));

// ── Helpers ──────────────────────────────────────────────

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
      if (Array.isArray(children)) return children.filter((c) => typeof c === 'string').join('');
      return '';
    })
    .join(' ');
}

const makeNotif = (overrides: Partial<Notif> = {}): Notif => ({
  id: 'n1',
  type: 'task',
  audience: 'admin',
  group: 'Hoje',
  title: 'Tarefa pendente',
  description: '1 entrega para validar',
  time: 'há 5 min',
  route: '/(admin)/tasks',
  needsAction: true,
  ...overrides,
});

// ── Tests ────────────────────────────────────────────────

describe('AdminNotificationsScreen', () => {
  beforeEach(() => {
    routerMock.back.mockReset();
    routerMock.push.mockReset();
    inboxMock.items = [];
    inboxMock.isLoading = false;
  });

  it('shows loading indicator when loading', () => {
    inboxMock.isLoading = true;
    const renderer = render(<AdminNotificationsScreen />);
    const indicators = renderer.root.findAllByType('ActivityIndicator' as never);
    expect(indicators.length).toBeGreaterThan(0);
  });

  it('shows empty state when no notifications', () => {
    inboxMock.items = [];
    const renderer = render(<AdminNotificationsScreen />);
    const text = allText(renderer);
    expect(text).toContain('Sem notificações');
  });

  it('renders notification cards grouped by date', () => {
    inboxMock.items = [
      makeNotif({ id: 'n1', group: 'Hoje', title: 'Nova entrega' }),
      makeNotif({ id: 'n2', group: 'Ontem', title: 'Resgate pedido' }),
    ];
    const renderer = render(<AdminNotificationsScreen />);
    const text = allText(renderer);
    expect(text).toContain('Hoje');
    expect(text).toContain('Ontem');
    expect(text).toContain('Nova entrega');
    expect(text).toContain('Resgate pedido');
  });

  it('shows action badge for actionable notifications', () => {
    inboxMock.items = [makeNotif({ needsAction: true })];
    const renderer = render(<AdminNotificationsScreen />);
    const text = allText(renderer);
    expect(text).toContain('REQUER AÇÃO');
  });

  it('navigates when a notification card is pressed', () => {
    inboxMock.items = [makeNotif({ route: '/(admin)/tasks' })];
    const renderer = render(<AdminNotificationsScreen />);
    const pressables = renderer.root.findAllByType('Pressable' as never);
    const card = pressables.find((p) => p.props.accessibilityLabel?.includes('Tarefa pendente'));
    expect(card).toBeDefined();
    act(() => card!.props.onPress());
    expect(routerMock.push).toHaveBeenCalledWith('/(admin)/tasks');
  });

  it('calls router.back when header back is pressed', () => {
    const renderer = render(<AdminNotificationsScreen />);
    const header = renderer.root.findByType('ScreenHeader' as never);
    act(() => header.props.onBack());
    expect(routerMock.back).toHaveBeenCalled();
  });

  it('shows filter pills with counts', () => {
    inboxMock.items = [
      makeNotif({ id: 'n1', needsAction: true }),
      makeNotif({ id: 'n2', needsAction: false }),
    ];
    const renderer = render(<AdminNotificationsScreen />);
    const text = allText(renderer);
    expect(text).toContain('Todas');
    expect(text).toContain('Pendências');
  });
});
