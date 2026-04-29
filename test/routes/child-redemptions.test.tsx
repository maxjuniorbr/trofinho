import React from 'react';
import { act, create, type ReactTestRenderer } from '../helpers/test-renderer-compat';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ChildRedemptionsScreen from '../../app/(child)/redemptions/index';

const routerMock = vi.hoisted(() => ({
    back: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    dismissTo: vi.fn(),
}));

const redemptionsMock = vi.hoisted(() => ({
    data: undefined as
        | {
            pages: {
                data: {
                    id: string;
                    status: string;
                    pontos_debitados: number;
                    created_at: string;
                    premios: { nome: string; emoji: string; custo_pontos: number };
                }[];
                hasMore: boolean;
            }[];
        }
        | undefined,
    isLoading: false,
    isFetching: false,
    error: null as Error | null,
    refetch: vi.fn(),
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
}));

const MOCK_REDEMPTIONS = [
    { id: 'r1', status: 'pendente', pontos_debitados: 50, created_at: '2026-04-15T10:00:00Z', premios: { nome: 'Sorvete', emoji: '🍦', custo_pontos: 50 } },
    { id: 'r2', status: 'confirmado', pontos_debitados: 30, created_at: '2026-04-14T10:00:00Z', premios: { nome: 'Livro', emoji: '📚', custo_pontos: 30 } },
];

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
    Animated: {
        Value: class AnimatedValue {
            interpolate() {
                return '50%';
            }
        },
        timing: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
        View: createHostComponent('AnimatedView'),
    },
    Keyboard: {
        addListener: vi.fn(() => ({ remove: vi.fn() })),
        dismiss: vi.fn(),
    },
    Pressable: createHostComponent('Pressable'),
    RefreshControl: createHostComponent('RefreshControl'),
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 0.5 },
    Text: createHostComponent('Text'),
    View: createHostComponent('View'),
}));

vi.mock('expo-status-bar', () => ({
    StatusBar: createHostComponent('StatusBar'),
}));

vi.mock('expo-router', () => ({
    useRouter: () => routerMock,
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
    Star: (props: Record<string, unknown>) => React.createElement('Star', props),
    House: (props: Record<string, unknown>) => React.createElement('House', props),
    ClipboardList: (props: Record<string, unknown>) => React.createElement('ClipboardList', props),
    Gift: (props: Record<string, unknown>) => React.createElement('Gift', props),
    ShoppingBag: (props: Record<string, unknown>) => React.createElement('ShoppingBag', props),
    UserCircle: (props: Record<string, unknown>) => React.createElement('UserCircle', props),
}));

vi.mock('@sentry/react-native', () => ({
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    addBreadcrumb: vi.fn(),
}));

vi.mock('@lib/status', () => ({
    getRedemptionStatusColor: () => '#000',
    getRedemptionStatusLabel: (s: string) => s,
}));

vi.mock('@lib/utils', () => ({
    formatDate: () => '15/04/2026',
}));

vi.mock('@/hooks/queries', () => ({
    useChildRedemptions: () => redemptionsMock,
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

vi.mock('@/components/ui/skeleton', () => ({
    ListScreenSkeleton: () => React.createElement('ListScreenSkeleton'),
}));

vi.mock('@/components/ui/list-footer', () => ({
    ListFooter: (props: Record<string, unknown>) => React.createElement('ListFooter', props),
}));

vi.mock('@/components/ui/segmented-bar', () => ({
    SegmentedBar: (props: Record<string, unknown>) => {
        const options = props.options as { key: string; label: string }[];
        return React.createElement(
            'SegmentedBar',
            props,
            ...options.map((o) => React.createElement('Text', { key: o.key }, o.label)),
        );
    },
}));

vi.mock('@/context/theme-context', () => ({
    useTheme: () => ({
        colors: {
            statusBar: 'dark',
            bg: { canvas: '#fff', surface: '#fff', muted: '#f0f0f0', elevated: '#eee' },
            text: {
                primary: '#000',
                secondary: '#666',
                muted: '#999',
                inverse: '#fff',
                onBrand: '#fff',
                onBrandMuted: '#ccc',
            },
            accent: { filho: '#3366CC', filhoBg: '#EEF' },
            border: { subtle: '#eee' },
            brand: { vivid: '#000' },
            semantic: {
                success: '#0a0',
                successBg: '#e0ffe0',
                error: '#c00',
                errorBg: '#ffe0e0',
                warning: '#fa0',
                warningBg: '#fff6e5',
                info: '#08f',
                infoBg: '#e0f0ff',
            },
        },
    }),
}));

vi.mock('@/context/impersonation-context', () => ({
    useImpersonation: () => ({ impersonating: null, startImpersonation: vi.fn(), stopImpersonation: vi.fn() }),
}));

vi.mock('@/constants/theme', () => ({
    gradients: {
        goldHorizontal: { colors: ['#f0c', '#fc0'], start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
    },
    radii: { xl: 16, lg: 12, md: 8, inner: 8, full: 999 },
    shadows: { card: {}, goldGlow: {} },
    spacing: { '0.5': 2, '1': 4, '2': 8, '3': 12, '4': 16, '5': 20, '6': 24, '12': 48, screen: 16 },
    typography: {
        size: { xxs: 10, xs: 12, sm: 14, md: 16, lg: 18, '2xl': 24, '3xl': 30 },
        family: { medium: 'medium', semibold: 'semibold', bold: 'bold', extrabold: 'extrabold', black: 'black' },
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

describe('ChildRedemptionsScreen', () => {
    beforeEach(() => {
        routerMock.back.mockReset();
        routerMock.push.mockReset();
        routerMock.replace.mockReset();
        routerMock.dismissTo.mockReset();
        redemptionsMock.data = {
            pages: [
                {
                    data: [...MOCK_REDEMPTIONS],
                    hasMore: false,
                },
            ],
        };
        redemptionsMock.isLoading = false;
        redemptionsMock.isFetching = false;
        redemptionsMock.error = null;
        redemptionsMock.refetch.mockReset();
        redemptionsMock.fetchNextPage.mockReset();
        redemptionsMock.hasNextPage = false;
        redemptionsMock.isFetchingNextPage = false;
    });

    it('shows skeleton when loading', () => {
        redemptionsMock.isLoading = true;
        redemptionsMock.data = undefined;
        const renderer = render(<ChildRedemptionsScreen />);
        const skeleton = renderer.root.findByType('ListScreenSkeleton' as never);
        expect(skeleton).toBeDefined();
    });

    it('shows empty state when no redemptions', () => {
        redemptionsMock.data = { pages: [{ data: [], hasMore: false }] };
        const renderer = render(<ChildRedemptionsScreen />);
        const empty = renderer.root.findByType('EmptyState' as never);
        expect(empty).toBeDefined();
        expect(empty.props.empty).toBe(true);
    });

    it('renders screen header with title "Resgates"', () => {
        const renderer = render(<ChildRedemptionsScreen />);
        const header = renderer.root.findByType('ScreenHeader' as never);
        expect(header.props.title).toBe('Resgates');
        expect(header.props.role).toBe('filho');
    });

    it('renders segmented bar with tabs (Pendentes, Concluídos, Todos)', () => {
        const renderer = render(<ChildRedemptionsScreen />);
        const text = allText(renderer);
        expect(text).toContain('Pendentes');
        expect(text).toContain('Concluídos');
        expect(text).toContain('Todos');
    });

    it('renders redemption items with prize name and points', () => {
        const renderer = render(<ChildRedemptionsScreen />);
        const text = allText(renderer);
        // Default tab is "pendentes", so only the pending item shows
        expect(text).toContain('Sorvete');
        expect(text).toContain('50');
    });

    it('renders status badge for each redemption', () => {
        const renderer = render(<ChildRedemptionsScreen />);
        const text = allText(renderer);
        // getRedemptionStatusLabel returns the status string as-is
        expect(text).toContain('pendente');
    });
});
