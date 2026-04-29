import React from 'react';
import { act, create, type ReactTestRenderer } from '../helpers/test-renderer-compat';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ChildHistoryScreen from '../../app/(child)/historico';

const routerMock = vi.hoisted(() => ({
    back: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    canGoBack: vi.fn().mockReturnValue(true),
}));

const transactionsMock = vi.hoisted(() => ({
    data: undefined as Record<string, unknown>[] | undefined,
    isLoading: false,
    isFetching: false,
    error: null as Error | null,
    refetch: vi.fn(),
}));

const profileMock = vi.hoisted(() => ({
    data: { id: 'u1', nome: 'João', familia_id: 'fam-1' } as Record<string, unknown> | undefined,
}));

const myChildIdMock = vi.hoisted(() => ({
    data: 'c1' as string | undefined,
}));

const MOCK_TRANSACTIONS = [
    { id: 'tx1', tipo: 'credito', valor: 10, descricao: 'Tarefa aprovada', created_at: '2026-04-15T10:00:00Z', data_referencia: '2026-04-15', referencia_id: null, filho_id: 'c1' },
    { id: 'tx2', tipo: 'resgate', valor: 30, descricao: 'Resgate de prêmio', created_at: '2026-04-15T11:00:00Z', data_referencia: '2026-04-15', referencia_id: null, filho_id: 'c1' },
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

vi.mock('expo-linear-gradient', () => ({
    LinearGradient: createHostComponent('LinearGradient'),
}));

vi.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('@shopify/flash-list', () => ({
    FlashList: React.forwardRef(function MockFlashList(
        props: Record<string, unknown>,
        ref: React.ForwardedRef<unknown>,
    ) {
        const data = props.data as Record<string, unknown>[] | undefined;
        const renderItem = props.renderItem as
            | ((info: { item: Record<string, unknown> }) => React.ReactNode)
            | undefined;
        const ListHeaderComponent = props.ListHeaderComponent as React.ReactNode | undefined;
        React.useImperativeHandle(ref, () => ({ scrollToOffset: () => { }, scrollToTop: () => { } }));
        return React.createElement(
            'FlashList',
            props,
            ListHeaderComponent,
            data && data.length > 0 && renderItem
                ? data.map((item) =>
                    React.createElement(
                        React.Fragment,
                        { key: item.key as string },
                        renderItem({ item }),
                    ),
                )
                : null,
        );
    }),
}));

vi.mock('lucide-react-native', () => ({
    ArrowDownLeft: (props: Record<string, unknown>) => React.createElement('ArrowDownLeft', props),
    ArrowUpRight: (props: Record<string, unknown>) => React.createElement('ArrowUpRight', props),
    ChevronLeft: (props: Record<string, unknown>) => React.createElement('ChevronLeft', props),
    ChevronRight: (props: Record<string, unknown>) => React.createElement('ChevronRight', props),
    Trophy: (props: Record<string, unknown>) => React.createElement('Trophy', props),
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

vi.mock('@lib/balances', () => ({
    formatTransactionDates: () => ({
        hasEventDate: false,
        sameDay: true,
        showRecordedPhrase: false,
        recordedPhrase: '',
        recordedDate: '',
        recordedLabel: '',
    }),
    getTransactionCategory: (tipo: string) => {
        if (tipo === 'credito') return 'ganho';
        if (tipo === 'resgate') return 'gasto';
        return 'ganho';
    },
    getTransactionTypeLabel: (tipo: string) => {
        if (tipo === 'credito') return 'Crédito';
        if (tipo === 'resgate') return 'Resgate';
        return tipo;
    },
    isCredit: (tipo: string) => tipo === 'credito',
}));

vi.mock('@lib/utils', () => ({
    formatDate: () => '15/04/2026',
    formatDateRelative: () => 'Hoje',
    toDateString: () => '2026-04-15',
}));

vi.mock('@lib/safe-area', () => ({
    getSafeHorizontalPadding: () => ({ paddingLeft: 0, paddingRight: 0 }),
    getSafeTopPadding: () => 0,
}));

vi.mock('@/hooks/queries', () => ({
    useTransactionsByPeriod: () => transactionsMock,
    useProfile: () => profileMock,
    useMyChildId: () => myChildIdMock,
}));

vi.mock('@/hooks/use-footer-items', () => ({
    useChildFooterItems: () => [],
}));

vi.mock('@/components/ui/empty-state', () => ({
    EmptyState: (props: Record<string, unknown>) => React.createElement('EmptyState', props),
}));

vi.mock('@/components/ui/screen-header', () => ({
    ScreenHeader: (props: Record<string, unknown>) => React.createElement('ScreenHeader', props),
    HeaderIconButton: (props: Record<string, unknown>) =>
        React.createElement('HeaderIconButton', props),
}));

vi.mock('@/components/ui/safe-screen-frame', () => ({
    SafeScreenFrame: ({ children }: { children?: React.ReactNode }) =>
        React.createElement('SafeScreenFrame', null, children),
}));

vi.mock('@/components/balance/transaction-icon', () => ({
    TransactionIcon: (props: Record<string, unknown>) =>
        React.createElement('TransactionIcon', props),
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
                successText: '#060',
                error: '#c00',
                errorBg: '#ffe0e0',
                errorText: '#600',
                warning: '#fa0',
                warningBg: '#fff6e5',
                warningText: '#850',
                info: '#08f',
                infoBg: '#e0f0ff',
                infoText: '#046',
            },
        },
    }),
}));

vi.mock('@/context/impersonation-context', () => ({
    useImpersonation: () => ({
        impersonating: null,
        startImpersonation: vi.fn(),
        stopImpersonation: vi.fn(),
    }),
}));

vi.mock('@/components/ui/skeleton', () => ({
    ListScreenSkeleton: () => React.createElement('ListScreenSkeleton'),
}));

vi.mock('@/constants/theme', () => ({
    gradients: {
        gold: { colors: ['#f0c', '#fc0'], start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } },
        goldHorizontal: { colors: ['#f0c', '#fc0'], start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
    },
    radii: { xl: 16, lg: 12, md: 8, inner: 8, full: 999 },
    shadows: { card: {}, goldGlow: {} },
    spacing: {
        '0.5': 2,
        '1': 4,
        '2': 8,
        '3': 12,
        '4': 16,
        '5': 20,
        '6': 24,
        '12': 48,
        screen: 16,
    },
    typography: {
        size: { xxs: 10, xs: 12, sm: 14, md: 16, lg: 18, '2xl': 24, '3xl': 30 },
        family: {
            medium: 'medium',
            semibold: 'semibold',
            bold: 'bold',
            extrabold: 'extrabold',
            black: 'black',
        },
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

describe('ChildHistoryScreen', () => {
    beforeEach(() => {
        routerMock.back.mockReset();
        routerMock.push.mockReset();
        routerMock.replace.mockReset();
        routerMock.canGoBack.mockReset().mockReturnValue(true);
        transactionsMock.data = [...MOCK_TRANSACTIONS] as unknown as Record<string, unknown>[];
        transactionsMock.isLoading = false;
        transactionsMock.isFetching = false;
        transactionsMock.error = null;
        transactionsMock.refetch.mockReset();
        profileMock.data = { id: 'u1', nome: 'João', familia_id: 'fam-1' };
        myChildIdMock.data = 'c1';
    });

    it('shows loading EmptyState when isLoading', () => {
        transactionsMock.isLoading = true;
        transactionsMock.data = undefined;
        const renderer = render(<ChildHistoryScreen />);
        const empty = renderer.root.findByType('EmptyState' as never);
        expect(empty).toBeDefined();
        expect(empty.props.loading).toBe(true);
    });

    it('renders "Extrato" header title', () => {
        const renderer = render(<ChildHistoryScreen />);
        const text = allText(renderer);
        expect(text).toContain('Extrato');
    });

    it('renders month navigation with current month label', () => {
        const renderer = render(<ChildHistoryScreen />);
        const pressables = renderer.root.findAllByType('Pressable' as never);
        const monthNavButtons = pressables.filter(
            (p) =>
                p.props.accessibilityLabel === 'Mês anterior' ||
                p.props.accessibilityLabel === 'Próximo mês',
        );
        expect(monthNavButtons.length).toBe(2);
    });

    it('renders stats row with ENTRADAS and SAÍDAS', () => {
        const renderer = render(<ChildHistoryScreen />);
        const text = allText(renderer);
        expect(text).toContain('ENTRADAS');
        expect(text).toContain('SAÍDAS');
    });

    it('renders filter pills: Tudo, Ganhos, Gastos, Cofrinho', () => {
        const renderer = render(<ChildHistoryScreen />);
        const text = allText(renderer);
        expect(text).toContain('Tudo');
        expect(text).toContain('Ganhos');
        expect(text).toContain('Gastos');
        expect(text).toContain('Cofrinho');
    });

    it('shows "Nenhuma transação neste mês." when no transactions', () => {
        transactionsMock.data = [];
        const renderer = render(<ChildHistoryScreen />);
        const text = allText(renderer);
        expect(text).toContain('Nenhuma transação neste mês.');
    });

    it('renders transaction items when data is available', () => {
        const renderer = render(<ChildHistoryScreen />);
        const text = allText(renderer);
        expect(text).toContain('Tarefa aprovada');
        expect(text).toContain('Resgate de prêmio');
    });
});
