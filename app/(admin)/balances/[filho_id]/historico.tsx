import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ArrowDownLeft,
    ArrowUpRight,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react-native';
import {
    getTransactionCategory,
    getTransactionTypeLabel,
    isCredit,
    type Transaction,
    type TransactionCategory,
} from '@lib/balances';
import { formatDate } from '@lib/utils';
import { useTransactionsByPeriod, useChildDetail } from '@/hooks/queries';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { gradients, radii, spacing, typography } from '@/constants/theme';
import { HeaderIconButton } from '@/components/ui/screen-header';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { EmptyState } from '@/components/ui/empty-state';
import { TransactionIcon } from '@/components/balance/transaction-icon';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSafeHorizontalPadding, getSafeTopPadding } from '@lib/safe-area';

type FilterKey = 'all' | 'ganhos' | 'gastos' | 'cofrinho';

const FILTER_CATEGORIES: Record<Exclude<FilterKey, 'all'>, TransactionCategory> = {
    ganhos: 'ganho',
    gastos: 'gasto',
    cofrinho: 'cofrinho',
};

const FILTERS: readonly { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'Tudo' },
    { key: 'ganhos', label: 'Ganhos' },
    { key: 'gastos', label: 'Gastos' },
    { key: 'cofrinho', label: 'Cofrinho' },
];

const monthBounds = (year: number, month: number) => {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 1);
    return { from: start.toISOString(), to: end.toISOString() };
};

const formatMonthLabel = (year: number, month: number): string => {
    const date = new Date(year, month, 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

const isCurrentMonth = (year: number, month: number): boolean => {
    const now = new Date();
    return year === now.getFullYear() && month === now.getMonth();
};

const groupByDay = (items: Transaction[]): { label: string; items: Transaction[] }[] => {
    const map = new Map<string, Transaction[]>();
    for (const tx of items) {
        const label = formatDate(tx.created_at);
        const list = map.get(label);
        if (list) list.push(tx);
        else map.set(label, [tx]);
    }
    return Array.from(map.entries()).map(([label, groupItems]) => ({ label, items: groupItems }));
};

export default function ChildBalanceHistoryScreen() {
    const { filho_id, nome } = useLocalSearchParams<{ filho_id: string; nome: string }>();
    const router = useRouter();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => makeStyles(colors), [colors]);

    const { data: childDetail } = useChildDetail(filho_id);
    const childName = nome ?? childDetail?.nome ?? 'Filho';

    const now = useMemo(() => new Date(), []);
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth());
    const [filter, setFilter] = useState<FilterKey>('all');
    const listRef = useRef<FlashListRef<{ label: string; items: Transaction[] }>>(null);

    const handleFilterChange = useCallback((key: FilterKey) => {
        setFilter(key);
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, []);

    const { from, to } = useMemo(() => monthBounds(year, month), [year, month]);
    const transactionsQuery = useTransactionsByPeriod(filho_id, from, to);

    const allTransactions = useMemo(
        () => transactionsQuery.data ?? [],
        [transactionsQuery.data],
    );

    const filtered = useMemo(() => {
        if (filter === 'all') return allTransactions;
        const cat = FILTER_CATEGORIES[filter];
        return allTransactions.filter((t) => getTransactionCategory(t.tipo) === cat);
    }, [allTransactions, filter]);

    const totals = useMemo(() => {
        let entradas = 0;
        let saidas = 0;
        for (const tx of allTransactions) {
            const cat = getTransactionCategory(tx.tipo);
            if (cat === 'ganho') entradas += tx.valor;
            else if (cat === 'gasto') saidas += tx.valor;
        }
        return { entradas, saidas };
    }, [allTransactions]);

    const groups = useMemo(() => groupByDay(filtered), [filtered]);

    const currentMonthLabel = useMemo(() => formatMonthLabel(year, month), [year, month]);
    const canGoForward = !isCurrentMonth(year, month);

    const goToPrevMonth = useCallback(() => {
        setMonth((m) => {
            if (m === 0) {
                setYear((y) => y - 1);
                return 11;
            }
            return m - 1;
        });
    }, []);

    const goToNextMonth = useCallback(() => {
        if (!canGoForward) return;
        setMonth((m) => {
            if (m === 11) {
                setYear((y) => y + 1);
                return 0;
            }
            return m + 1;
        });
    }, [canGoForward]);

    const handleBack = useCallback(() => {
        if (router.canGoBack()) router.back();
        else router.replace('/(admin)/');
    }, [router]);

    const handleRefresh = useCallback(async () => {
        await transactionsQuery.refetch();
    }, [transactionsQuery]);

    if (transactionsQuery.isLoading) {
        return (
            <View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
                <StatusBar style={colors.statusBar} />
                <EmptyState loading />
            </View>
        );
    }

    return (
        <SafeScreenFrame bottomInset>
            <StatusBar style={colors.statusBar} />

            <View
                style={[
                    styles.customHeader,
                    {
                        paddingTop: getSafeTopPadding(insets, spacing['3']),
                        ...getSafeHorizontalPadding(insets, spacing['4']),
                        backgroundColor: colors.bg.surface,
                        borderBottomColor: colors.border.subtle,
                    },
                ]}
            >
                <HeaderIconButton
                    icon={ChevronLeft}
                    onPress={handleBack}
                    accessibilityLabel="Voltar"
                />
                <View style={styles.headerCenter}>
                    <Text
                        style={[styles.headerTitle, { color: colors.text.primary }]}
                        numberOfLines={1}
                    >
                        Extrato · {childName}
                    </Text>
                </View>
                <View style={styles.headerSpacer} />
            </View>

            <FlashList
                ref={listRef}
                data={groups}
                keyExtractor={(g) => g.label}
                contentContainerStyle={styles.lista}
                refreshControl={
                    <RefreshControl
                        refreshing={transactionsQuery.isFetching && !transactionsQuery.isLoading}
                        onRefresh={handleRefresh}
                        tintColor={colors.brand.vivid}
                    />
                }
                ListHeaderComponent={
                    <>
                        {/* Month navigator */}
                        <View style={styles.monthNav}>
                            <Pressable
                                onPress={goToPrevMonth}
                                accessibilityRole="button"
                                accessibilityLabel="Mês anterior"
                                hitSlop={12}
                            >
                                <ChevronLeft
                                    size={20}
                                    color={colors.text.primary}
                                    strokeWidth={2}
                                />
                            </Pressable>
                            <Text
                                style={[
                                    styles.monthNavLabel,
                                    { color: colors.text.primary },
                                ]}
                            >
                                {currentMonthLabel}
                            </Text>
                            <Pressable
                                onPress={goToNextMonth}
                                accessibilityRole="button"
                                accessibilityLabel="Próximo mês"
                                hitSlop={12}
                                disabled={!canGoForward}
                            >
                                <ChevronRight
                                    size={20}
                                    color={
                                        canGoForward
                                            ? colors.text.primary
                                            : colors.text.muted
                                    }
                                    strokeWidth={2}
                                />
                            </Pressable>
                        </View>

                        <View style={styles.statsRow}>
                            <View
                                style={[
                                    styles.statBox,
                                    { backgroundColor: colors.semantic.successBg },
                                ]}
                            >
                                <ArrowDownLeft
                                    size={16}
                                    color={colors.semantic.success}
                                    strokeWidth={2}
                                />
                                <Text
                                    style={[
                                        styles.statValue,
                                        { color: colors.semantic.success },
                                    ]}
                                >
                                    +{totals.entradas}
                                </Text>
                                <Text
                                    style={[
                                        styles.statLabel,
                                        { color: colors.semantic.successText },
                                    ]}
                                >
                                    ENTRADAS
                                </Text>
                            </View>
                            <View
                                style={[
                                    styles.statBox,
                                    { backgroundColor: colors.semantic.errorBg },
                                ]}
                            >
                                <ArrowUpRight
                                    size={16}
                                    color={colors.semantic.error}
                                    strokeWidth={2}
                                />
                                <Text
                                    style={[
                                        styles.statValue,
                                        { color: colors.semantic.error },
                                    ]}
                                >
                                    -{totals.saidas}
                                </Text>
                                <Text
                                    style={[
                                        styles.statLabel,
                                        { color: colors.semantic.error },
                                    ]}
                                >
                                    SAÍDAS
                                </Text>
                            </View>
                        </View>

                        <View style={styles.filtersRow}>
                            {FILTERS.map((f) => {
                                const active = filter === f.key;
                                if (active) {
                                    return (
                                        <LinearGradient
                                            key={f.key}
                                            colors={gradients.gold.colors}
                                            start={gradients.gold.start}
                                            end={gradients.gold.end}
                                            style={styles.filterPill}
                                        >
                                            <Pressable
                                                onPress={() => handleFilterChange(f.key)}
                                                accessibilityRole="button"
                                                accessibilityLabel={`Filtrar ${f.label}`}
                                                style={styles.filterPressable}
                                            >
                                                <Text
                                                    style={[
                                                        styles.filterLabel,
                                                        { color: colors.text.primary },
                                                    ]}
                                                >
                                                    {f.label}
                                                </Text>
                                            </Pressable>
                                        </LinearGradient>
                                    );
                                }
                                return (
                                    <Pressable
                                        key={f.key}
                                        onPress={() => handleFilterChange(f.key)}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Filtrar ${f.label}`}
                                        style={[
                                            styles.filterPill,
                                            styles.filterPressable,
                                            { backgroundColor: colors.bg.muted },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.filterLabel,
                                                { color: colors.text.muted },
                                            ]}
                                        >
                                            {f.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        {groups.length === 0 ? (
                            <Text style={[styles.empty, { color: colors.text.muted }]}>
                                Nenhuma transação neste mês.
                            </Text>
                        ) : null}
                    </>
                }
                renderItem={({ item: group }) => (
                    <View style={styles.dayBlock}>
                        <Text style={[styles.dayLabel, { color: colors.text.muted }]}>
                            {group.label}
                        </Text>
                        <View
                            style={[
                                styles.dayCard,
                                {
                                    backgroundColor: colors.bg.surface,
                                    borderColor: colors.border.subtle,
                                },
                            ]}
                        >
                            {group.items.map((tx, idx) => (
                                <View
                                    key={tx.id}
                                    style={[
                                        styles.txRow,
                                        idx < group.items.length - 1
                                            ? {
                                                borderBottomColor: colors.border.subtle,
                                                borderBottomWidth: StyleSheet.hairlineWidth,
                                            }
                                            : null,
                                    ]}
                                >
                                    <TransactionIcon type={tx.tipo} style={styles.txIconBox} />
                                    <View style={styles.txInfo}>
                                        <Text
                                            style={[
                                                styles.txLabel,
                                                { color: colors.text.primary },
                                            ]}
                                        >
                                            {getTransactionTypeLabel(tx.tipo)}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.txDesc,
                                                { color: colors.text.muted },
                                            ]}
                                            numberOfLines={1}
                                        >
                                            {tx.descricao}
                                        </Text>
                                    </View>
                                    <View style={styles.txRight}>
                                        <Text
                                            style={[
                                                styles.txValue,
                                                {
                                                    color: (() => {
                                                        const cat = getTransactionCategory(tx.tipo);
                                                        if (cat === 'ganho') return colors.semantic.success;
                                                        if (cat === 'cofrinho') return colors.semantic.info;
                                                        return colors.semantic.error;
                                                    })(),
                                                },
                                            ]}
                                        >
                                            {isCredit(tx.tipo) ? '+' : '-'}
                                            {tx.valor}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
            />
        </SafeScreenFrame>
    );
}

function makeStyles(colors: ThemeColors) {
    return StyleSheet.create({
        center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        customHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: spacing['3'],
            borderBottomWidth: 1,
        },
        headerCenter: {
            flex: 1,
            alignItems: 'flex-start',
            marginHorizontal: spacing['3'],
        },
        headerTitle: {
            fontSize: typography.size.md,
            fontFamily: typography.family.extrabold,
        },
        headerSpacer: { width: 36 },
        lista: { padding: spacing['5'], paddingBottom: spacing['12'] },
        monthNav: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing['4'],
        },
        monthNavLabel: {
            fontSize: typography.size.md,
            fontFamily: typography.family.bold,
            textTransform: 'capitalize',
        },
        statsRow: {
            flexDirection: 'row',
            gap: spacing['3'],
            marginBottom: spacing['4'],
        },
        statBox: {
            flex: 1,
            borderRadius: radii.lg,
            borderCurve: 'continuous',
            paddingVertical: spacing['3'],
            paddingHorizontal: spacing['2'],
            alignItems: 'center',
            gap: spacing['0.5'],
        },
        statValue: {
            fontSize: typography.size.lg,
            fontFamily: typography.family.extrabold,
            fontVariant: ['tabular-nums'],
        },
        statLabel: {
            fontSize: typography.size.xxs,
            fontFamily: typography.family.bold,
            letterSpacing: 0.5,
        },
        filtersRow: {
            flexDirection: 'row',
            gap: spacing['2'],
            marginBottom: spacing['4'],
        },
        filterPill: {
            flex: 1,
            borderRadius: radii.full,
            overflow: 'hidden',
        },
        filterPressable: {
            paddingVertical: spacing['2'],
            alignItems: 'center',
            justifyContent: 'center',
        },
        filterLabel: {
            fontSize: typography.size.xs,
            fontFamily: typography.family.bold,
        },
        dayBlock: {
            marginBottom: spacing['4'],
        },
        dayLabel: {
            fontSize: typography.size.xxs,
            fontFamily: typography.family.bold,
            letterSpacing: 0.5,
            marginBottom: spacing['2'],
        },
        dayCard: {
            borderRadius: radii.lg,
            borderCurve: 'continuous',
            borderWidth: 1,
            overflow: 'hidden',
        },
        txRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing['4'],
            paddingVertical: spacing['3'],
        },
        txIconBox: {
            width: 32,
            height: 32,
            borderRadius: radii.md,
            borderCurve: 'continuous',
            marginRight: spacing['3'],
        },
        txInfo: { flex: 1 },
        txLabel: {
            fontSize: typography.size.xs,
            fontFamily: typography.family.bold,
        },
        txDesc: {
            fontSize: typography.size.xxs,
            marginTop: spacing['0.5'],
        },
        txRight: { alignItems: 'flex-end', gap: spacing['0.5'] },
        txValue: {
            fontSize: typography.size.sm,
            fontFamily: typography.family.extrabold,
            fontVariant: ['tabular-nums'],
        },
        empty: {
            fontSize: typography.size.sm,
            textAlign: 'center',
            marginTop: spacing['6'],
        },
    });
}
