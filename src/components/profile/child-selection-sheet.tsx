import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { ChevronRight, Star, Users } from 'lucide-react-native';
import { BottomSheetModal } from '@/components/ui/bottom-sheet';
import { Avatar } from '@/components/ui/avatar';
import { useChildrenList, useAdminBalances } from '@/hooks/queries';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import type { BalanceWithChild } from '@lib/balances';

type ChildSelectionSheetProps = Readonly<{
    visible: boolean;
    onClose: () => void;
    onSelectChild: (child: { id: string; nome: string }) => void;
}>;

export function ChildSelectionSheet({
    visible,
    onClose,
    onSelectChild,
}: ChildSelectionSheetProps) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);

    const { data: allChildren = [] } = useChildrenList();
    const { data: balances = [] } = useAdminBalances();

    const activeChildren = useMemo(
        () => allChildren.filter((c) => c.ativo === true),
        [allChildren],
    );

    const balancesMap = useMemo(
        () => new Map<string, BalanceWithChild>(balances.map((b) => [b.filho_id, b])),
        [balances],
    );

    return (
        <BottomSheetModal
            visible={visible}
            onClose={onClose}
            sheetStyle={styles.sheet}
            closeLabel="Fechar seleção de filho"
        >
            <View style={styles.header}>
                <View style={[styles.headerIcon, { backgroundColor: colors.accent.adminBg }]}>
                    <Users size={18} color={colors.accent.adminDim} strokeWidth={2.4} />
                </View>
                <View style={styles.headerText}>
                    <Text style={[styles.title, { color: colors.text.primary }]}>Ver app como filho</Text>
                    <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
                        Selecione para navegar como ele
                    </Text>
                </View>
            </View>

            {activeChildren.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
                        Nenhum filho ativo encontrado.
                    </Text>
                </View>
            ) : (
                <ScrollView
                    overScrollMode="never"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.list}
                >
                    {activeChildren.map((child) => {
                        const balance = balancesMap.get(child.id);
                        const totalPts = balance ? balance.saldo_livre + balance.cofrinho : 0;

                        return (
                            <Pressable
                                key={child.id}
                                style={({ pressed }) => [
                                    styles.childRow,
                                    { backgroundColor: pressed ? colors.border.subtle : colors.bg.muted },
                                ]}
                                onPress={() => onSelectChild({ id: child.id, nome: child.nome })}
                                accessibilityRole="button"
                                accessibilityLabel={`Selecionar ${child.nome}, ${totalPts} pontos`}
                            >
                                <Avatar name={child.nome} size={44} imageUri={child.avatar_url} />
                                <View style={styles.childInfo}>
                                    <Text style={[styles.childName, { color: colors.text.primary }]} numberOfLines={1}>
                                        {child.nome}
                                    </Text>
                                    <View style={styles.ptsRow}>
                                        <Star size={12} color={colors.brand.vivid} fill={colors.brand.vivid} />
                                        <Text style={[styles.ptsText, { color: colors.text.secondary }]}>
                                            {totalPts} pts no total
                                        </Text>
                                    </View>
                                </View>
                                <ChevronRight size={16} color={colors.text.muted} strokeWidth={2} style={{ opacity: 0.6 }} />
                            </Pressable>
                        );
                    })}
                </ScrollView>
            )}
        </BottomSheetModal>
    );
}

function makeStyles(colors: ThemeColors) {
    return StyleSheet.create({
        sheet: {
            borderCurve: 'continuous',
            maxHeight: '70%',
        },
        header: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: spacing['3'],
            marginBottom: spacing['4'],
        },
        headerIcon: {
            width: 40,
            height: 40,
            borderRadius: radii.full,
            alignItems: 'center',
            justifyContent: 'center',
        },
        headerText: {
            flex: 1,
            gap: spacing['0.5'],
        },
        title: {
            fontSize: typography.size.md,
            fontFamily: typography.family.bold,
        },
        subtitle: {
            fontSize: typography.size.xs,
            fontFamily: typography.family.semibold,
        },
        emptyContainer: {
            alignItems: 'center',
            paddingVertical: spacing['8'],
        },
        emptyText: {
            fontFamily: typography.family.medium,
            fontSize: typography.size.sm,
        },
        list: {
            gap: spacing['2'],
            paddingBottom: spacing['2'],
        },
        childRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing['3'],
            paddingVertical: spacing['3'],
            paddingHorizontal: spacing['4'],
            borderRadius: radii.xl,
        },
        childInfo: {
            flex: 1,
            gap: spacing['0.5'],
        },
        childName: {
            fontSize: typography.size.sm,
            fontFamily: typography.family.bold,
        },
        ptsRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing['1'],
        },
        ptsText: {
            fontSize: typography.size.xs,
            fontFamily: typography.family.medium,
        },
    });
}
