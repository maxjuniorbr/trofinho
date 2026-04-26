import React from 'react';
import { act, create, type ReactTestRenderer } from '../helpers/test-renderer-compat';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Unit tests for child screens in impersonation mode.
 *
 * Validates:
 * - Requirement 5.3: Data loaded with childId from impersonation context
 * - Requirement 5.4: Mutative actions disabled; profile hides edit/logout
 */

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const impersonationMock = vi.hoisted(() => ({
    impersonating: null as { childId: string; childName: string } | null,
    startImpersonation: vi.fn(),
    stopImpersonation: vi.fn(),
}));

const routerMock = vi.hoisted(() => ({
    back: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    dismissTo: vi.fn(),
}));

const alertMock = vi.hoisted(() => ({
    alert: vi.fn(),
}));

// ─── Balance screen mocks ────────────────────────────────────────────────────

const profileMock = vi.hoisted(() => ({
    data: { id: 'u1', nome: 'João', familia_id: 'fam-1', papel: 'filho' } as
        | Record<string, unknown>
        | undefined,
    isLoading: false,
    error: null as Error | null,
    refetch: vi.fn(),
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
        periodo_valorizacao: 'mensal',
        proxima_valorizacao_em: '2025-07-01',
        taxa_resgate_cofrinho: 10,
    } as Record<string, unknown> | null,
    isLoading: false,
    error: null as Error | null,
    refetch: vi.fn(),
}));

const transactionsMock = vi.hoisted(() => ({
    data: [
        {
            id: 't1',
            tipo: 'credito_tarefa',
            descricao: 'Tarefa concluída',
            valor: 50,
            created_at: '2025-06-01',
            data_referencia: '2025-06-01',
        },
    ] as Record<string, unknown>[] | undefined,
    isLoading: false,
    isFetching: false,
    error: null as Error | null,
    refetch: vi.fn(),
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

// ─── Prizes screen mocks ────────────────────────────────────────────────────

const prizesMock = vi.hoisted(() => ({
    data: {
        pages: [
            {
                data: [
                    {
                        id: 'p1',
                        nome: 'Bicicleta',
                        descricao: 'MTB legal',
                        custo_pontos: 30,
                        emoji: '🚲',
                        ativo: true,
                        estoque: 5,
                    },
                ],
                hasMore: false,
            },
        ],
    } as { pages: { data: Record<string, unknown>[]; hasMore: boolean }[] } | undefined,
    isLoading: false,
    error: null as Error | null,
    refetch: vi.fn(),
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    isFetchingNextPage: false,
}));

const redeemMutationMock = vi.hoisted(() => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
}));

// ─── Perfil screen mocks ────────────────────────────────────────────────────

const authUserMock = vi.hoisted(() => ({
    data: { email: 'joao@example.com', avatarUrl: null } as
        | Record<string, unknown>
        | undefined
        | null,
    isLoading: false,
    error: null as Error | null,
    refetch: vi.fn(),
}));

const notifPrefsMock = vi.hoisted(() => ({
    data: { tarefa_concluida: true, resgate_solicitado: true, valorizacao: true } as Record<
        string,
        boolean
    > | null,
    isLoading: false,
    error: null as Error | null,
    refetch: vi.fn(),
}));

const signOutMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const deleteAccountMock = vi.hoisted(() => ({
    mutate: vi.fn(),
    isPending: false,
}));

// ─── Host component factory ─────────────────────────────────────────────────

const createHostComponent = vi.hoisted(() => {
    return (name: string) =>
        React.forwardRef(function HostComponent(
            props: Record<string, unknown> & { children?: React.ReactNode },
            ref: React.ForwardedRef<unknown>,
        ) {
            return React.createElement(name, { ...props, ref }, props.children);
        });
});

// ─── Module mocks ────────────────────────────────────────────────────────────

vi.mock('@/context/impersonation-context', () => ({
    useImpersonation: () => impersonationMock,
}));

vi.mock('expo-router', () => ({
    useRouter: () => routerMock,
}));

vi.mock('react-native', () => ({
    ActivityIndicator: createHostComponent('ActivityIndicator'),
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
    KeyboardAvoidingView: createHostComponent('KeyboardAvoidingView'),
    Modal: createHostComponent('Modal'),
    Platform: { OS: 'ios', select: (obj: Record<string, unknown>) => obj.ios },
    Pressable: createHostComponent('Pressable'),
    RefreshControl: createHostComponent('RefreshControl'),
    ScrollView: createHostComponent('ScrollView'),
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 0.5 },
    Text: createHostComponent('Text'),
    TextInput: createHostComponent('TextInput'),
    View: createHostComponent('View'),
}));

vi.mock('expo-status-bar', () => ({
    StatusBar: createHostComponent('StatusBar'),
}));

vi.mock('expo-linear-gradient', () => ({
    LinearGradient: createHostComponent('LinearGradient'),
}));

vi.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    initialWindowMetrics: {
        frame: { x: 0, y: 0, width: 0, height: 0 },
        insets: { top: 0, right: 0, bottom: 34, left: 0 },
    },
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
    PiggyBank: (props: Record<string, unknown>) => React.createElement('PiggyBank', props),
    TrendingUp: (props: Record<string, unknown>) => React.createElement('TrendingUp', props),
    Wallet: (props: Record<string, unknown>) => React.createElement('Wallet', props),
    AlertTriangle: (props: Record<string, unknown>) => React.createElement('AlertTriangle', props),
    Trophy: (props: Record<string, unknown>) => React.createElement('Trophy', props),
    CheckCircle2: (props: Record<string, unknown>) => React.createElement('CheckCircle2', props),
    House: (props: Record<string, unknown>) => React.createElement('House', props),
    ClipboardList: (props: Record<string, unknown>) => React.createElement('ClipboardList', props),
    Gift: (props: Record<string, unknown>) => React.createElement('Gift', props),
    ShoppingBag: (props: Record<string, unknown>) => React.createElement('ShoppingBag', props),
    UserCircle: (props: Record<string, unknown>) => React.createElement('UserCircle', props),
    ChevronRight: createHostComponent('ChevronRight'),
    Info: createHostComponent('Info'),
    Lock: createHostComponent('Lock'),
    User: createHostComponent('User'),
    Star: (props: Record<string, unknown>) => React.createElement('Star', props),
}));

vi.mock('@sentry/react-native', () => ({
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    addBreadcrumb: vi.fn(),
}));

vi.mock('@lib/haptics', () => ({
    hapticSuccess: vi.fn(),
}));

vi.mock('@lib/utils', () => ({
    formatDate: (d: string) => d,
    formatDateShort: (d: string) => d,
    toDateString: (d: Date) => d.toISOString().slice(0, 10),
}));

vi.mock('@lib/balances', () => ({
    getAppreciationPeriodLabel: (s: string) => s,
    getTransactionTypeLabel: (t: string) => t,
    getTransactionCategory: (t: string) => (t.startsWith('credito') ? 'ganho' : 'gasto'),
    isCredit: (t: string) => t.startsWith('credito'),
    calculateProjection: (cofrinho: number, rate: number) =>
        rate > 0 && cofrinho > 0 ? Math.max(Math.floor((cofrinho * rate) / 100), 1) : 0,
    formatTransactionDates: (tx: { created_at: string; data_referencia: string }) => ({
        eventDate: tx.created_at,
        showRecordedPhrase: false,
        recordedPhrase: null,
    }),
}));

vi.mock('@lib/safe-area', () => ({
    getSafeBottomPadding: () => 34,
}));

vi.mock('@lib/auth', () => ({
    signOut: signOutMock,
}));

vi.mock('@lib/notifications', () => ({
    setNotificationPrefs: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/hooks/queries', () => ({
    useProfile: () => profileMock,
    useMyChildId: () => childIdMock,
    useBalance: () => balanceMock,
    useTransactionsByPeriod: () => transactionsMock,
    useTransferToPiggyBank: () => transferMutationMock,
    useChildPendingWithdrawal: () => pendingWithdrawalMock,
    useRequestPiggyBankWithdrawal: () => withdrawalMutationMock,
    useCancelPiggyBankWithdrawal: () => cancelWithdrawalMutationMock,
    useActivePrizes: () => prizesMock,
    useRequestRedemption: () => redeemMutationMock,
    useCurrentAuthUser: () => authUserMock,
    useNotificationPrefs: () => notifPrefsMock,
    useDeleteAccount: () => deleteAccountMock,
    combineQueryStates: (...queries: Record<string, unknown>[]) => ({
        isLoading: queries.some((q) => q.isLoading),
        isFetching: queries.some((q) => q.isFetching),
        error: queries.find((q) => q.error)?.error ?? null,
        refetchAll: vi.fn().mockResolvedValue(undefined),
    }),
}));

vi.mock('@/hooks/use-transient-message', () => ({
    useTransientMessage: (msg: string | null) => msg,
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

vi.mock('@/components/ui/screen-header', () => ({
    ScreenHeader: (props: Record<string, unknown>) => React.createElement('ScreenHeader', props),
}));

vi.mock('@/components/ui/safe-screen-frame', () => ({
    SafeScreenFrame: ({ children }: { children?: React.ReactNode }) =>
        React.createElement('SafeScreenFrame', null, children),
}));

vi.mock('@/components/balance/transaction-icon', () => ({
    TransactionIcon: (props: Record<string, unknown>) =>
        React.createElement('TransactionIcon', props),
}));

vi.mock('@/components/ui/inline-message', () => ({
    InlineMessage: (props: Record<string, unknown>) => React.createElement('InlineMessage', props),
}));

vi.mock('@/components/ui/list-footer', () => ({
    ListFooter: (props: Record<string, unknown>) => React.createElement('ListFooter', props),
}));

vi.mock('@/components/ui/skeleton', () => ({
    ListScreenSkeleton: () => React.createElement('ListScreenSkeleton'),
}));

vi.mock('@/components/ui/bottom-sheet', () => ({
    BottomSheetModal: (props: Record<string, unknown> & { children?: React.ReactNode }) =>
        React.createElement('BottomSheetModal', props, props.children),
}));

vi.mock('@/components/ui/logout-button', () => ({
    LogoutButton: (props: Record<string, unknown>) => React.createElement('LogoutButton', props),
}));

vi.mock('@/components/profile/avatar-section', () => ({
    AvatarSection: (props: Record<string, unknown>) => React.createElement('AvatarSection', props),
}));

vi.mock('@/components/profile/personal-data-sheet', () => ({
    PersonalDataSheet: (props: Record<string, unknown>) =>
        React.createElement('PersonalDataSheet', props),
}));

vi.mock('@/components/profile/change-password-sheet', () => ({
    ChangePasswordSheet: (props: Record<string, unknown>) =>
        React.createElement('ChangePasswordSheet', props),
}));

vi.mock('@/components/profile/theme-card', () => ({
    ThemeCard: (props: Record<string, unknown>) => React.createElement('ThemeCard', props),
}));

vi.mock('@/components/profile/notification-card', () => ({
    NotificationCard: (props: Record<string, unknown>) =>
        React.createElement('NotificationCard', props),
}));

vi.mock('@/components/ui/home-footer-bar', () => ({
    FOOTER_BAR_HEIGHT: 56,
    HomeFooterBar: () => React.createElement('HomeFooterBar'),
}));

vi.mock('@/context/theme-context', () => ({
    useTheme: () => ({
        colors: {
            statusBar: 'dark',
            bg: { canvas: '#fff', surface: '#fff', elevated: '#fafafa', muted: '#f0f0f0' },
            text: {
                primary: '#000',
                secondary: '#666',
                muted: '#999',
                inverse: '#fff',
                onBrand: '#fff',
                onBrandMuted: '#ccc',
            },
            accent: { filho: '#3366CC', filhoBg: '#EEF' },
            border: { default: '#ddd', subtle: '#eee' },
            brand: { vivid: '#000' },
            semantic: {
                success: '#0a0',
                successBg: '#e0ffe0',
                error: '#c00',
                warning: '#fa0',
                warningBg: '#fff7e0',
            },
            overlay: { scrimSoft: 'rgba(0,0,0,0.3)' },
        },
    }),
}));

vi.mock('@/constants/theme', () => ({
    gradients: {
        gold: { colors: ['#FAC114', '#C57B0D'], start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } },
        goldHorizontal: { colors: ['#f0c', '#fc0'], start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
    },
    radii: { xl: 16, lg: 12, md: 8, sm: 4, inner: 8, full: 999 },
    shadows: { card: {}, goldGlow: {} },
    spacing: {
        '0.5': 2,
        '0.75': 3,
        '1': 4,
        '1.5': 6,
        '2': 8,
        '3': 12,
        '4': 16,
        '5': 20,
        '6': 24,
        '8': 32,
        '12': 48,
        screen: 16,
    },
    staticTextColors: { inverse: '#fff' },
    typography: {
        size: {
            xxs: 10,
            xs: 12,
            sm: 14,
            md: 16,
            lg: 18,
            xl: 20,
            '2xl': 24,
            '3xl': 30,
            '4xl': 36,
        },
        lineHeight: { '4xl': 40 },
        family: {
            medium: 'medium',
            semibold: 'semibold',
            bold: 'bold',
            extrabold: 'extrabold',
            black: 'black',
        },
    },
}));

vi.mock('@/constants/colors', () => ({
    darkColors: {
        bg: { surface: '#1D212B', elevated: '#2A303C' },
    },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Imports (after mocks) ───────────────────────────────────────────────────

// eslint-disable-next-line import/first
import ChildBalanceScreen from '../../app/(child)/balance';
// eslint-disable-next-line import/first
import ChildPrizesScreen from '../../app/(child)/prizes/index';
// eslint-disable-next-line import/first
import ChildProfileScreen from '../../app/(child)/perfil';

// ─── Tests ───────────────────────────────────────────────────────────────────

const IMPERSONATION_STATE = { childId: 'imp-child-1', childName: 'Maria' };

describe('Child screens in impersonation mode', () => {
    beforeEach(() => {
        routerMock.back.mockReset();
        routerMock.push.mockReset();
        routerMock.replace.mockReset();
        routerMock.dismissTo.mockReset();
        alertMock.alert.mockReset();

        // Default: impersonation active
        impersonationMock.impersonating = IMPERSONATION_STATE;

        // Balance screen defaults
        profileMock.data = { id: 'u1', nome: 'João', familia_id: 'fam-1', papel: 'filho' };
        profileMock.isLoading = false;
        childIdMock.data = 'child-1';
        childIdMock.isError = false;
        balanceMock.data = {
            saldo_livre: 200,
            cofrinho: 80,
            indice_valorizacao: 5,
            periodo_valorizacao: 'mensal',
            proxima_valorizacao_em: '2025-07-01',
            taxa_resgate_cofrinho: 10,
        };
        balanceMock.isLoading = false;
        transactionsMock.data = [
            {
                id: 't1',
                tipo: 'credito_tarefa',
                descricao: 'Tarefa concluída',
                valor: 50,
                created_at: '2025-06-01',
                data_referencia: '2025-06-01',
            },
        ];
        transactionsMock.isLoading = false;
        transactionsMock.isFetching = false;
        transferMutationMock.mutateAsync.mockReset().mockResolvedValue(undefined);
        pendingWithdrawalMock.data = null;

        // Prizes screen defaults
        prizesMock.data = {
            pages: [
                {
                    data: [
                        {
                            id: 'p1',
                            nome: 'Bicicleta',
                            descricao: 'MTB legal',
                            custo_pontos: 30,
                            emoji: '🚲',
                            ativo: true,
                            estoque: 5,
                        },
                    ],
                    hasMore: false,
                },
            ],
        };
        prizesMock.isLoading = false;
        prizesMock.error = null;

        // Perfil screen defaults
        authUserMock.data = { email: 'joao@example.com', avatarUrl: null };
        authUserMock.isLoading = false;
        notifPrefsMock.data = { tarefa_concluida: true, resgate_solicitado: true, valorizacao: true };
        notifPrefsMock.isLoading = false;
        signOutMock.mockReset().mockResolvedValue(undefined);
    });

    // ─── Balance screen ──────────────────────────────────────────────────────

    describe('ChildBalanceScreen — impersonation mode', () => {
        it('disables "Depositar" button when impersonating', () => {
            const renderer = render(<ChildBalanceScreen />);
            const buttons = renderer.root.findAllByType('Button' as never);
            const piggyBtn = buttons.find((b) => b.props.label === 'Depositar');
            expect(piggyBtn).toBeDefined();
            expect(piggyBtn!.props.disabled).toBe(true);
        });

        it('enables "Depositar" button when NOT impersonating', () => {
            impersonationMock.impersonating = null;
            const renderer = render(<ChildBalanceScreen />);
            const buttons = renderer.root.findAllByType('Button' as never);
            const piggyBtn = buttons.find((b) => b.props.label === 'Depositar');
            expect(piggyBtn).toBeDefined();
            expect(piggyBtn!.props.disabled).toBe(false);
        });

        it('disables "Cancelar resgate" button for pending withdrawal when impersonating', () => {
            pendingWithdrawalMock.data = {
                id: 'w1',
                valor_solicitado: 50,
                valor_liquido: 45,
                status: 'pendente',
            };
            const renderer = render(<ChildBalanceScreen />);
            const buttons = renderer.root.findAllByType('Button' as never);
            const cancelBtn = buttons.find((b) => b.props.label === 'Cancelar resgate');
            expect(cancelBtn).toBeDefined();
            expect(cancelBtn?.props.disabled).toBe(true);
        });

        it('disables "Retirar" button when impersonating', () => {
            const renderer = render(<ChildBalanceScreen />);
            const buttons = renderer.root.findAllByType('Button' as never);
            const withdrawBtn = buttons.find((b) => b.props.label === 'Retirar');
            expect(withdrawBtn).toBeDefined();
            expect(withdrawBtn?.props.disabled).toBe(true);
        });

        it('still renders balance data correctly when impersonating', () => {
            const renderer = render(<ChildBalanceScreen />);
            const text = allText(renderer);
            expect(text).toContain('SALDO LIVRE');
            expect(text).toContain('200');
            expect(text).toContain('COFRINHO');
            expect(text).toContain('80');
        });
    });

    // ─── Prizes screen ────────────────────────────────────────────────────────

    describe('ChildPrizesScreen — impersonation mode', () => {
        it('disables "Resgatar" button when impersonating', () => {
            // Prize costs 30, balance is 50 (affordable) — but impersonating
            balanceMock.data = { saldo_livre: 50 };
            const renderer = render(<ChildPrizesScreen />);
            const buttons = renderer.root.findAllByType('Button' as never);
            const redeemBtn = buttons.find((b) => b.props.label === 'Resgatar');
            expect(redeemBtn).toBeDefined();
            expect(redeemBtn!.props.disabled).toBe(true);
        });

        it('enables "Resgatar" button when NOT impersonating and affordable', () => {
            impersonationMock.impersonating = null;
            balanceMock.data = { saldo_livre: 50 };
            const renderer = render(<ChildPrizesScreen />);
            const buttons = renderer.root.findAllByType('Button' as never);
            const redeemBtn = buttons.find((b) => b.props.label === 'Resgatar');
            expect(redeemBtn).toBeDefined();
            expect(redeemBtn!.props.disabled).toBe(false);
        });

        it('still renders prize data correctly when impersonating', () => {
            const renderer = render(<ChildPrizesScreen />);
            const text = allText(renderer);
            expect(text).toContain('Bicicleta');
            expect(text).toContain('30');
        });
    });

    // ─── Profile screen ───────────────────────────────────────────────────────

    describe('ChildProfileScreen — impersonation mode', () => {
        it('shows AvatarSection when impersonating', () => {
            const renderer = render(<ChildProfileScreen />);
            const avatarSections = renderer.root.findAllByType('AvatarSection' as never);
            expect(avatarSections.length).toBe(1);
        });

        it('shows ThemeCard disabled when impersonating', () => {
            const renderer = render(<ChildProfileScreen />);
            const themeCards = renderer.root.findAllByType('ThemeCard' as never);
            expect(themeCards.length).toBe(1);
            expect(themeCards[0].props.disabled).toBe(true);
        });

        it('shows NotificationCard disabled when impersonating', () => {
            const renderer = render(<ChildProfileScreen />);
            const notifCards = renderer.root.findAllByType('NotificationCard' as never);
            expect(notifCards.length).toBe(1);
            expect(notifCards[0].props.disabled).toBe(true);
        });

        it('shows "Dados pessoais" section when impersonating', () => {
            const renderer = render(<ChildProfileScreen />);
            const text = allText(renderer);
            expect(text).toContain('Dados pessoais');
        });

        it('shows "Segurança" section when impersonating', () => {
            const renderer = render(<ChildProfileScreen />);
            const text = allText(renderer);
            expect(text).toContain('Segurança');
        });

        it('shows LogoutButton disabled when impersonating', () => {
            const renderer = render(<ChildProfileScreen />);
            const logoutBtns = renderer.root.findAllByType('LogoutButton' as never);
            expect(logoutBtns.length).toBe(1);
            expect(logoutBtns[0].props.disabled).toBe(true);
        });

        it('shows "Excluir minha conta" button disabled when impersonating', () => {
            const renderer = render(<ChildProfileScreen />);
            const buttons = renderer.root.findAllByType('Button' as never);
            const deleteBtn = buttons.find((b) => b.props.label === 'Excluir minha conta');
            expect(deleteBtn).toBeDefined();
            expect(deleteBtn?.props.disabled).toBe(true);
        });

        it('still shows "Sobre" section when impersonating', () => {
            const renderer = render(<ChildProfileScreen />);
            const text = allText(renderer);
            expect(text).toContain('Sobre');
            expect(text).toContain('Versão');
        });

        it('shows all sections when NOT impersonating', () => {
            impersonationMock.impersonating = null;
            const renderer = render(<ChildProfileScreen />);
            const avatarSections = renderer.root.findAllByType('AvatarSection' as never);
            expect(avatarSections.length).toBe(1);
            const themeCards = renderer.root.findAllByType('ThemeCard' as never);
            expect(themeCards.length).toBe(1);
            const logoutBtns = renderer.root.findAllByType('LogoutButton' as never);
            expect(logoutBtns.length).toBe(1);
            const text = allText(renderer);
            expect(text).toContain('Dados pessoais');
            expect(text).toContain('Segurança');
        });
    });
});
