import React from 'react';
import { act, create, type ReactTestRenderer } from '../helpers/test-renderer-compat';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ChildBalanceAdminScreen from '../../app/(admin)/balances/[filho_id]/index';

const routerMock = vi.hoisted(() => ({
    back: vi.fn(),
    replace: vi.fn(),
    push: vi.fn(),
    canGoBack: vi.fn(() => true),
}));

const balanceMock = vi.hoisted(() => ({
    data: null as Record<string, unknown> | null,
    isLoading: false,
    isFetching: false,
    refetch: vi.fn().mockResolvedValue(undefined),
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

const profileMock = vi.hoisted(() => ({
    data: { familia_id: 'fam-1', role: 'admin' } as Record<string, unknown> | null,
}));

const pendingWithdrawalsMock = vi.hoisted(() => ({
    data: [] as Record<string, unknown>[],
}));

const configurePiggyMutationMock = vi.hoisted(() => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
}));

const penaltyMutationMock = vi.hoisted(() => ({
    mutateAsync: vi.fn().mockResolvedValue({ deducted: 10 }),
    isPending: false,
}));

const confirmWithdrawalMutationMock = vi.hoisted(() => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
}));

const cancelWithdrawalMutationMock = vi.hoisted(() => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
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
    Alert: { alert: vi.fn() },
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
                        { key: (item.id as string) ?? i },
                        renderItem({ item }),
                    ),
                )
                : null,
            ListFooterComponent,
        ),
}));

vi.mock('lucide-react-native', () => ({
    TrendingUp: (props: Record<string, unknown>) => React.createElement('TrendingUp', props),
    PiggyBank: (props: Record<string, unknown>) => React.createElement('PiggyBank', props),
    Settings: (props: Record<string, unknown>) => React.createElement('Settings', props),
    Wallet: (props: Record<string, unknown>) => React.createElement('Wallet', props),
    AlertTriangle: (props: Record<string, unknown>) => React.createElement('AlertTriangle', props),
    ChevronLeft: (props: Record<string, unknown>) => React.createElement('ChevronLeft', props),
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

vi.mock('@/components/ui/avatar', () => ({
    Avatar: (props: Record<string, unknown>) => React.createElement('Avatar', props),
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

vi.mock('@/components/ui/inline-message', () => ({
    InlineMessage: (props: Record<string, unknown>) => React.createElement('InlineMessage', props),
}));

vi.mock('@/components/ui/button', () => ({
    Button: (props: Record<string, unknown>) => React.createElement('Button', props),
}));

vi.mock('@/components/balance/penalty-modal', () => ({
    PenaltyModal: (props: Record<string, unknown>) => React.createElement('PenaltyModal', props),
    PenaltyButton: (props: Record<string, unknown>) => React.createElement('PenaltyButton', props),
}));

vi.mock('@/components/balance/piggy-config-sheet', () => ({
    PiggyConfigSheet: (props: Record<string, unknown>) =>
        React.createElement('PiggyConfigSheet', props),
}));

vi.mock('@/components/balance/transaction-icon', () => ({
    TransactionIcon: (props: Record<string, unknown>) =>
        React.createElement('TransactionIcon', props),
}));

vi.mock('@lib/haptics', () => ({
    hapticSuccess: vi.fn(),
}));

vi.mock('@lib/safe-area', () => ({
    getSafeTopPadding: () => 0,
    getSafeHorizontalPadding: () => ({}),
}));

vi.mock('@/hooks/use-transient-message', () => ({
    useTransientMessage: (msg: string | null) => msg,
}));

vi.mock('@/context/theme-context', () => ({
    useTheme: () => ({
        colors: {
            statusBar: 'dark',
            brand: { vivid: '#FAC114', dim: '#C57B0D' },
            bg: { surface: '#fff', canvas: '#fff', muted: '#f5f5f5' },
            border: { subtle: '#eee' },
            text: { primary: '#000', secondary: '#666', muted: '#999', inverse: '#fff' },
            accent: { admin: '#FAC114', adminDim: '#C57B0D', adminBg: '#FFF8E1' },
            semantic: {
                success: '#20C55D',
                successBg: '#E8F8EE',
                successText: '#166534',
                warning: '#F59E0B',
                warningBg: '#FFFBEB',
                warningText: '#92400E',
                error: '#EF4444',
                info: '#3B82F6',
                infoBg: '#E5F2FF',
                infoText: '#0F4D8A',
            },
        },
    }),
}));

vi.mock('@/hooks/queries', () => ({
    useBalance: () => balanceMock,
    useTransactionsByPeriod: () => transactionsMock,
    useProfile: () => profileMock,
    useChildDetail: () => childDetailMock,
    combineQueryStates: () => ({
        isLoading: balanceMock.isLoading || transactionsMock.isLoading,
        isFetching: balanceMock.isFetching || transactionsMock.isFetching,
        refetchAll: vi.fn().mockResolvedValue(undefined),
    }),
    useApplyPenalty: () => penaltyMutationMock,
    useConfigurePiggyBank: () => configurePiggyMutationMock,
    usePendingPiggyBankWithdrawals: () => pendingWithdrawalsMock,
    useConfirmPiggyBankWithdrawal: () => confirmWithdrawalMutationMock,
    useCancelPiggyBankWithdrawal: () => cancelWithdrawalMutationMock,
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

describe('ChildBalanceAdminScreen', () => {
    beforeEach(() => {
        routerMock.back.mockReset();
        routerMock.replace.mockReset();
        routerMock.canGoBack.mockReturnValue(true);

        balanceMock.data = {
            filho_id: 'child-1',
            saldo_livre: 500,
            cofrinho: 300,
            indice_valorizacao: 10,
            periodo_valorizacao: 'mensal',
            data_ultima_valorizacao: null,
            proxima_valorizacao_em: null,
            taxa_resgate_cofrinho: 15,
            prazo_bloqueio_dias: 7,
            updated_at: '2025-01-01T00:00:00Z',
        };
        balanceMock.isLoading = false;
        balanceMock.isFetching = false;

        transactionsMock.data = [
            {
                id: 'tx-1',
                tipo: 'tarefa',
                descricao: 'Arrumar o quarto',
                valor: 50,
                created_at: '2025-01-15T10:00:00Z', data_referencia: '2025-01-15',
            },
        ];
        transactionsMock.isLoading = false;
        transactionsMock.isFetching = false;

        childDetailMock.data = { nome: 'Ana Maria', avatar_url: null };
        profileMock.data = { familia_id: 'fam-1', role: 'admin' };
        pendingWithdrawalsMock.data = [];

        configurePiggyMutationMock.mutateAsync.mockReset().mockResolvedValue(undefined);
        penaltyMutationMock.mutateAsync.mockReset().mockResolvedValue({ deducted: 10 });
    });

    it('shows loading empty state when loading', () => {
        balanceMock.isLoading = true;
        const renderer = render(React.createElement(ChildBalanceAdminScreen));
        const emptyState = renderer.root.findAll((n) => (n.type as string) === 'EmptyState');
        expect(emptyState.length).toBeGreaterThan(0);
        expect(emptyState[0].props.loading).toBe(true);
    });

    it('renders child name in custom header', () => {
        const renderer = render(React.createElement(ChildBalanceAdminScreen));
        const text = allText(renderer);
        expect(text).toContain('Ana');
    });

    it('renders both balance cards', () => {
        const renderer = render(React.createElement(ChildBalanceAdminScreen));
        const text = allText(renderer);
        expect(text).toContain('SALDO LIVRE');
        expect(text).toContain('COFRINHO');
        expect(text).toContain('500');
        expect(text).toContain('300');
    });

    it('renders cofrinho percentage in progress bar', () => {
        const renderer = render(React.createElement(ChildBalanceAdminScreen));
        const text = allText(renderer);
        // 300 / 800 = 37.5% → rounds to 38%
        expect(text).toContain('38% no cofrinho');
    });

    it('renders piggy rules card with appreciation rate', () => {
        const renderer = render(React.createElement(ChildBalanceAdminScreen));
        const text = allText(renderer);
        expect(text).toContain('Regras do cofrinho');
        expect(text).toContain('10%');
        expect(text).toContain('ao mês');
    });

    it('renders withdrawal rate in rules card', () => {
        const renderer = render(React.createElement(ChildBalanceAdminScreen));
        const text = allText(renderer);
        expect(text).toContain('TAXA DE SAQUE');
        expect(text).toContain('-15%');
    });

    it('renders projection when appreciation is configured and cofrinho > 0', () => {
        const renderer = render(React.createElement(ChildBalanceAdminScreen));
        const text = allText(renderer);
        // 300 * 10% = 30 pts
        expect(text).toContain('+30 pts no próximo mês');
    });

    it('shows "Rendimento não configurado" when rate is 0', () => {
        balanceMock.data = { ...balanceMock.data!, indice_valorizacao: 0 };
        const renderer = render(React.createElement(ChildBalanceAdminScreen));
        const text = allText(renderer);
        expect(text).toContain('Rendimento não configurado');
    });

    it('renders net amount in saque recebe stat', () => {
        const renderer = render(React.createElement(ChildBalanceAdminScreen));
        const text = allText(renderer);
        // Sem taxa após 7 dias (Lovable parity)
        expect(text).toContain('SEM TAXA APÓS');
        expect(text).toContain('7 dias');
    });

    it('renders transaction list', () => {
        const renderer = render(React.createElement(ChildBalanceAdminScreen));
        const text = allText(renderer);
        expect(text).toContain('Atividades de hoje');
        expect(text).toContain('Arrumar o quarto');
    });

    it('shows empty transactions message when no data', () => {
        transactionsMock.data = [];
        const renderer = render(React.createElement(ChildBalanceAdminScreen));
        const text = allText(renderer);
        expect(text).toContain('Nenhuma movimentação hoje.');
    });

    it('navigates back when back button is pressed', () => {
        const renderer = render(React.createElement(ChildBalanceAdminScreen));
        const pressables = renderer.root.findAll(
            (n) =>
                (n.type as string) === 'Pressable' && n.props.accessibilityLabel === 'Voltar',
        );
        expect(pressables.length).toBe(1);
        act(() => {
            pressables[0].props.onPress();
        });
        expect(routerMock.back).toHaveBeenCalled();
    });

    it('falls back to router.replace when canGoBack is false', () => {
        routerMock.canGoBack.mockReturnValue(false);
        const renderer = render(React.createElement(ChildBalanceAdminScreen));
        const pressables = renderer.root.findAll(
            (n) =>
                (n.type as string) === 'Pressable' && n.props.accessibilityLabel === 'Voltar',
        );
        act(() => {
            pressables[0].props.onPress();
        });
        expect(routerMock.replace).toHaveBeenCalledWith('/(admin)/');
    });

    it('opens config sheet when gear icon is pressed', () => {
        const renderer = render(React.createElement(ChildBalanceAdminScreen));
        const gearBtn = renderer.root.findAll(
            (n) =>
                (n.type as string) === 'Pressable' &&
                n.props.accessibilityLabel === 'Configurar cofrinho',
        );
        expect(gearBtn.length).toBe(1);
        act(() => {
            gearBtn[0].props.onPress();
        });
        const sheet = renderer.root.findAll((n) => (n.type as string) === 'PiggyConfigSheet');
        expect(sheet.length).toBe(1);
        expect(sheet[0].props.visible).toBe(true);
    });

    it('passes correct rates to PiggyConfigSheet', () => {
        const renderer = render(React.createElement(ChildBalanceAdminScreen));
        const sheet = renderer.root.findAll((n) => (n.type as string) === 'PiggyConfigSheet');
        expect(sheet[0].props.appreciationRate).toBe(10);
        expect(sheet[0].props.withdrawalRate).toBe(15);
        expect(sheet[0].props.prazoBloqueioDias).toBe(7);
    });

    it('renders penalty button and modal', () => {
        const renderer = render(React.createElement(ChildBalanceAdminScreen));
        const penaltyBtn = renderer.root.findAll((n) => (n.type as string) === 'PenaltyButton');
        expect(penaltyBtn.length).toBe(1);
        const penaltyModal = renderer.root.findAll((n) => (n.type as string) === 'PenaltyModal');
        expect(penaltyModal.length).toBe(1);
        expect(penaltyModal[0].props.visible).toBe(false);
    });

    it('hides progress bar when total is zero', () => {
        balanceMock.data = { ...balanceMock.data!, saldo_livre: 0, cofrinho: 0 };
        const renderer = render(React.createElement(ChildBalanceAdminScreen));
        const text = allText(renderer);
        expect(text).not.toContain('% no cofrinho');
    });

    it('shows dash when cofrinho is 0 in saque recebe', () => {
        balanceMock.data = { ...balanceMock.data!, cofrinho: 0 };
        const renderer = render(React.createElement(ChildBalanceAdminScreen));
        // Empty card should still render the SEM TAXA APÓS stat (no longer dash)
        const text = allText(renderer);
        expect(text).toContain('SEM TAXA APÓS');
    });

    it('navigates to history screen when "Ver extrato completo" is pressed', () => {
        const renderer = render(React.createElement(ChildBalanceAdminScreen));
        const link = renderer.root.findAll(
            (n) =>
                (n.type as string) === 'Pressable' &&
                n.props.accessibilityLabel === 'Ver extrato completo',
        )[0];
        act(() => {
            link.props.onPress();
        });
        expect(routerMock.push).toHaveBeenCalledWith({
            pathname: '/(admin)/balances/[filho_id]/historico',
            params: { filho_id: 'child-1', nome: 'Ana' },
        });
    });

    it('always shows "Ver extrato completo" button', () => {
        const renderer = render(React.createElement(ChildBalanceAdminScreen));
        const text = allText(renderer);
        expect(text).toContain('Ver extrato completo');
    });

    it('forwards onSave with three-field payload to mutation', async () => {
        const renderer = render(React.createElement(ChildBalanceAdminScreen));
        const sheet = renderer.root.findAll((n) => (n.type as string) === 'PiggyConfigSheet')[0];
        await act(async () => {
            await sheet.props.onSave({ rate: 12, withdrawalRate: 8, prazo: 14 });
        });
        expect(configurePiggyMutationMock.mutateAsync).toHaveBeenCalledWith({
            childId: 'child-1',
            rate: 12,
            withdrawalRate: 8,
            prazo: 14,
        });
    });
});
