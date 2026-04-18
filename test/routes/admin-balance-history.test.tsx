import React from 'react';
import { act, create, type ReactTestRenderer } from '../helpers/test-renderer-compat';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ChildBalanceHistoryScreen from '../../app/(admin)/balances/[filho_id]/historico';

const routerMock = vi.hoisted(() => ({
    back: vi.fn(),
    replace: vi.fn(),
    canGoBack: vi.fn(() => true),
}));

const transactionsMock = vi.hoisted(() => ({
    data: [] as Record<string, unknown>[] | null,
    isLoading: false,
    isFetching: false,
    refetch: vi.fn().mockResolvedValue(undefined),
}));

const childDetailMock = vi.hoisted(() => ({
    data: null as { nome: string; avatar_url: string | null } | null,
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
    useLocalSearchParams: () => ({ filho_id: 'child-1', nome: 'Ana' }),
}));

vi.mock('expo-linear-gradient', () => ({
    LinearGradient: createHostComponent('LinearGradient'),
}));

vi.mock('@shopify/flash-list', () => ({
    FlashList: ({
        data,
        renderItem,
        ListHeaderComponent,
        ListFooterComponent,
        ...props
    }: {
        data: Record<string, unknown>[];
        renderItem: (info: { item: Record<string, unknown> }) => React.ReactNode;
        ListHeaderComponent?: React.ReactNode;
        ListFooterComponent?: React.ReactNode;
        [key: string]: unknown;
    }) =>
        React.createElement(
            'FlashList',
            props,
            ListHeaderComponent,
            data && data.length > 0
                ? data.map((item, i) =>
                    React.createElement(
                        React.Fragment,
                        { key: (item.label as string) ?? i },
                        renderItem({ item }),
                    ),
                )
                : null,
            ListFooterComponent,
        ),
}));

vi.mock('lucide-react-native', () => ({
    ArrowDownLeft: (props: Record<string, unknown>) =>
        React.createElement('ArrowDownLeft', props),
    ArrowUpRight: (props: Record<string, unknown>) =>
        React.createElement('ArrowUpRight', props),
    ChevronLeft: (props: Record<string, unknown>) => React.createElement('ChevronLeft', props),
    ChevronRight: (props: Record<string, unknown>) => React.createElement('ChevronRight', props),
}));

vi.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('@/components/ui/empty-state', () => ({
    EmptyState: (props: Record<string, unknown>) => React.createElement('EmptyState', props),
}));

vi.mock('@/components/ui/safe-screen-frame', () => ({
    SafeScreenFrame: ({ children }: { children?: React.ReactNode }) =>
        React.createElement('SafeScreenFrame', null, children),
}));

vi.mock('@/components/ui/screen-header', () => ({
    HeaderIconButton: ({
        onPress,
        accessibilityLabel,
        icon: Icon,
    }: {
        onPress: () => void;
        accessibilityLabel: string;
        icon: React.ComponentType<Record<string, unknown>>;
    }) =>
        React.createElement(
            'Pressable',
            { onPress, accessibilityLabel },
            Icon ? React.createElement(Icon, {}) : null,
        ),
}));



vi.mock('@/components/balance/transaction-icon', () => ({
    TransactionIcon: (props: Record<string, unknown>) =>
        React.createElement('TransactionIcon', props),
}));

vi.mock('@lib/safe-area', () => ({
    getSafeTopPadding: () => 0,
    getSafeHorizontalPadding: () => ({}),
}));

vi.mock('@lib/utils', () => ({
    formatDate: (iso: string) => {
        const d = new Date(iso);
        const dd = String(d.getUTCDate()).padStart(2, '0');
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const yyyy = d.getUTCFullYear();
        return `${dd}/${mm}/${yyyy}`;
    },
}));



vi.mock('@/context/theme-context', () => ({
    useTheme: () => ({
        colors: {
            statusBar: 'dark',
            brand: { vivid: '#FAC114' },
            bg: { surface: '#fff', canvas: '#fff', muted: '#f5f5f5' },
            border: { subtle: '#eee' },
            text: { primary: '#000', secondary: '#666', muted: '#999' },
            accent: { admin: '#FAC114', adminDim: '#C57B0D', adminBg: '#FFF8E1' },
            semantic: {
                success: '#20C55D',
                successBg: '#E8F8EE',
                successText: '#166534',
                error: '#EF4444',
                errorBg: '#FEE2E2',
                errorText: '#991B1B',
                info: '#308CE8',
                infoBg: '#E5F2FF',
                infoText: '#0F4D8A',
            },
        },
    }),
}));

vi.mock('@/hooks/queries', () => ({
    useTransactionsByPeriod: () => transactionsMock,
    useChildDetail: () => childDetailMock,
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

describe('ChildBalanceHistoryScreen', () => {
    beforeEach(() => {
        routerMock.back.mockReset();
        routerMock.replace.mockReset();
        routerMock.canGoBack.mockReturnValue(true);

        transactionsMock.data = [
            {
                id: 'tx-1',
                tipo: 'credito',
                descricao: 'Arrumar a cama',
                valor: 10,
                created_at: '2026-04-01T10:00:00Z',
            },
            {
                id: 'tx-2',
                tipo: 'penalizacao',
                descricao: 'Brigou com irmão',
                valor: 5,
                created_at: '2026-04-02T10:00:00Z',
            },
            {
                id: 'tx-3',
                tipo: 'credito',
                descricao: 'Valorização mensal',
                valor: 8,
                created_at: '2026-04-01T15:00:00Z',
            },
            {
                id: 'tx-4',
                tipo: 'transferencia_cofrinho',
                descricao: 'Transferência para cofrinho',
                valor: 20,
                created_at: '2026-04-01T16:00:00Z',
            },
        ];
        transactionsMock.isLoading = false;
        transactionsMock.isFetching = false;

        childDetailMock.data = { nome: 'Ana Maria', avatar_url: null };
    });

    it('shows loading empty state when loading', () => {
        transactionsMock.isLoading = true;
        const renderer = render(React.createElement(ChildBalanceHistoryScreen));
        const emptyState = renderer.root.findAll((n) => (n.type as string) === 'EmptyState');
        expect(emptyState.length).toBeGreaterThan(0);
        expect(emptyState[0].props.loading).toBe(true);
    });

    it('renders header with child name', () => {
        const renderer = render(React.createElement(ChildBalanceHistoryScreen));
        const text = allText(renderer);
        expect(text).toContain('Extrato · Ana');
    });

    it('renders entradas and saidas totals', () => {
        const renderer = render(React.createElement(ChildBalanceHistoryScreen));
        const text = allText(renderer);
        // entradas (ganho) = 10 (credito) + 8 (credito) = 18
        // saidas (gasto) = 5 (penalizacao) = 5
        // cofrinho types are excluded from totals
        expect(text).toContain('+18');
        expect(text).toContain('-5');
        expect(text).toContain('ENTRADAS');
        expect(text).toContain('SAÍDAS');
    });

    it('renders four filter pills', () => {
        const renderer = render(React.createElement(ChildBalanceHistoryScreen));
        const text = allText(renderer);
        expect(text).toContain('Tudo');
        expect(text).toContain('Ganhos');
        expect(text).toContain('Gastos');
        expect(text).toContain('Cofrinho');
    });

    it('filters to ganhos when pressed', () => {
        const renderer = render(React.createElement(ChildBalanceHistoryScreen));
        const ganhosBtn = renderer.root.findAll(
            (n) =>
                (n.type as string) === 'Pressable' &&
                n.props.accessibilityLabel === 'Filtrar Ganhos',
        )[0];
        act(() => {
            ganhosBtn.props.onPress();
        });
        const text = allText(renderer);
        expect(text).not.toContain('Brigou com irmão');
        expect(text).toContain('Arrumar a cama');
    });

    it('filters to gastos when pressed', () => {
        const renderer = render(React.createElement(ChildBalanceHistoryScreen));
        const gastosBtn = renderer.root.findAll(
            (n) =>
                (n.type as string) === 'Pressable' &&
                n.props.accessibilityLabel === 'Filtrar Gastos',
        )[0];
        act(() => {
            gastosBtn.props.onPress();
        });
        const text = allText(renderer);
        expect(text).toContain('Brigou com irmão');
        expect(text).not.toContain('Arrumar a cama');
        expect(text).not.toContain('Transferência para cofrinho');
    });

    it('filters to cofrinho when pressed', () => {
        const renderer = render(React.createElement(ChildBalanceHistoryScreen));
        const cofrinhoBtn = renderer.root.findAll(
            (n) =>
                (n.type as string) === 'Pressable' &&
                n.props.accessibilityLabel === 'Filtrar Cofrinho',
        )[0];
        act(() => {
            cofrinhoBtn.props.onPress();
        });
        const text = allText(renderer);
        expect(text).toContain('Transferência para cofrinho');
        expect(text).not.toContain('Arrumar a cama');
        expect(text).not.toContain('Brigou com irmão');
    });

    it('groups transactions by day', () => {
        const renderer = render(React.createElement(ChildBalanceHistoryScreen));
        const text = allText(renderer);
        expect(text).toContain('01/04/2026');
        expect(text).toContain('02/04/2026');
    });

    it('navigates back when back button is pressed', () => {
        const renderer = render(React.createElement(ChildBalanceHistoryScreen));
        const back = renderer.root.findAll(
            (n) =>
                (n.type as string) === 'Pressable' &&
                n.props.accessibilityLabel === 'Voltar',
        )[0];
        act(() => {
            back.props.onPress();
        });
        expect(routerMock.back).toHaveBeenCalled();
    });

    it('falls back to router.replace when canGoBack is false', () => {
        routerMock.canGoBack.mockReturnValue(false);
        const renderer = render(React.createElement(ChildBalanceHistoryScreen));
        const back = renderer.root.findAll(
            (n) =>
                (n.type as string) === 'Pressable' &&
                n.props.accessibilityLabel === 'Voltar',
        )[0];
        act(() => {
            back.props.onPress();
        });
        expect(routerMock.replace).toHaveBeenCalledWith('/(admin)/');
    });

    it('shows empty message when no transactions', () => {
        transactionsMock.data = [];
        const renderer = render(React.createElement(ChildBalanceHistoryScreen));
        const text = allText(renderer);
        expect(text).toContain('Nenhuma transação neste mês.');
    });

    it('renders month navigator', () => {
        const renderer = render(React.createElement(ChildBalanceHistoryScreen));
        const prevBtn = renderer.root.findAll(
            (n) =>
                (n.type as string) === 'Pressable' &&
                n.props.accessibilityLabel === 'Mês anterior',
        );
        const nextBtn = renderer.root.findAll(
            (n) =>
                (n.type as string) === 'Pressable' &&
                n.props.accessibilityLabel === 'Próximo mês',
        );
        expect(prevBtn.length).toBe(1);
        expect(nextBtn.length).toBe(1);
    });
});
