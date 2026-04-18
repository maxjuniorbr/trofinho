import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight, ChevronLeft } from 'lucide-react-native';
import {
    getTransactionTypeLabel,
    isCredit,
    type Transaction,
} from '@lib/balances';
import { formatDate } from '@lib/utils';
import { useTransactions, useChildDetail } from '@/hooks/queries';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { gradients, radii, spacing, typography } from '@/constants/theme';
import { HeaderIconButton } from '@/components/ui/screen-header';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { EmptyState } from '@/components/ui/empty-state';
import { ListFooter } from '@/components/ui/list-footer';
import { TransactionIcon } from '@/components/balance/transaction-icon';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSafeHorizontalPadding, getSafeTopPadding } from '@lib/safe-area';

type FilterKey = 'all' | 'ganhos' | 'saidas';

const FILTERS: readonly { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'Tudo' },
    { key: 'ganhos', label: 'Ganhos' },
    { key: 'saidas', label: 'Saídas' },
];

type MonthGroup = Readonly<{
    label: string;
    items: Transaction[];
}>;

const monthLabel = (iso: string): string => {
    const date = new Date(iso);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

const groupByMonth = (items: Transaction[]): MonthGroup[] => {
    const map = new Map<string, Transaction[]>();
    for (const tx of items) {
        const label = monthLabel(tx.created_at);
        const list = map.get(label);
        if (list) {
            list.push(tx);
        } else {
            map.set(label, [tx]);
        }
    }
    return Array.from(map.entries()).map(([label, groupItems]) => ({
        label,
        items: groupItems,
    }));
};

export default function ChildBalanceHistoryScreen() {
    const { filho_id, nome } = useLocalSearchParams<{ filho_id: string; nome: string }>();
    const router = useRouter();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => makeStyles(colors), [colors]);

    const transactionsQuery = useTransactions(filho_id);
    const { data: childDetail } = useChildDetail(filho_id);
    const childName = nome ?? childDetail?.nome ?? 'Filho';

    const [filter, setFilter] = useState<FilterKey>('all');

    const allTransactions = useMemo(
        () => transactionsQuery.data?.pages.flatMap((p) => p.data) ?? [],
        [transactionsQuery.data],
    );

    const filtered = useMemo(() => {
        if (filter === 'all') return allTransactions;
        if (filter === 'ganhos') return allTransactions.filter((t) => isCredit(t.tipo));
        return allTransactions.filter((t) => !isCredit(t.tipo));
    }, [allTransactions, filter]);

    const totals = useMemo(() => {
        let entradas = 0;
        let saidas = 0;
        for (const tx of allTransactions) {
            if (isCredit(tx.tipo)) entradas += tx.valor;
            else saidas += tx.valor;
        }
        return { entradas, saidas };
    }, [allTransactions]);

    const groups = useMemo(() => groupByMonth(filtered), [filtered]);

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
                                                onPress={() => setFilter(f.key)}
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
                                        onPress={() => setFilter(f.key)}
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
                                Nenhuma transação encontrada
                            </Text>
                        ) : null}
                    </>
                }
                renderItem={({ item: group }) => (
                    <View style={styles.monthBlock}>
                        <Text style={[styles.monthLabel, { color: colors.text.muted }]}>
                            {group.label}
                        </Text>
                        <View
                            style={[
                                styles.monthCard,
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
                                                    color: isCredit(tx.tipo)
                                                        ? colors.semantic.success
                                                        : colors.semantic.error,
                                                },
                                            ]}
                                        >
                                            {isCredit(tx.tipo) ? '+' : '-'}
                                            {tx.valor}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.txDate,
                                                { color: colors.text.muted },
                                            ]}
                                        >
                                            {formatDate(tx.created_at)}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
                onEndReached={() => {
                    if (transactionsQuery.hasNextPage) transactionsQuery.fetchNextPage();
                }}
                onEndReachedThreshold={0.3}
                ListFooterComponent={
                    <ListFooter loading={transactionsQuery.isFetchingNextPage} />
                }
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
        monthBlock: {
            marginBottom: spacing['4'],
        },
        monthLabel: {
            fontSize: typography.size.xxs,
            fontFamily: typography.family.bold,
            letterSpacing: 0.5,
            textTransform: 'capitalize',
            marginBottom: spacing['2'],
        },
        monthCard: {
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
        txDate: { fontSize: typography.size.xxs, color: colors.text.muted },
        empty: {
            fontSize: typography.size.sm,
            textAlign: 'center',
            marginTop: spacing['6'],
        },
    });
}
