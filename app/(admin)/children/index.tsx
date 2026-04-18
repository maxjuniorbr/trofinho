import { StyleSheet, Text, View, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Eye, Plus, Star } from 'lucide-react-native';
import { HeaderIconButton, ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ListScreenSkeleton } from '@/components/ui/skeleton';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { Avatar } from '@/components/ui/avatar';
import { ChildViewSheet } from '@/components/children/child-view-sheet';
import { ChildNewSheet } from '@/components/children/child-new-sheet';
import { useChildrenList, useAdminBalances, combineQueryStates } from '@/hooks/queries';
import type { BalanceWithChild } from '@lib/balances';
import { useTheme } from '@/context/theme-context';
import { radii, shadows, spacing, typography } from '@/constants/theme';

export default function AdminChildrenScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [viewChildId, setViewChildId] = useState<string | null>(null);
  const [newSheetVisible, setNewSheetVisible] = useState(false);

  const childrenQuery = useChildrenList();
  const balancesQuery = useAdminBalances();
  const { isLoading, isFetching, error, refetchAll } = combineQueryStates(
    childrenQuery,
    balancesQuery,
  );

  const children = childrenQuery.data ?? [];
  const balancesMap = useMemo(() => {
    const balances = balancesQuery.data ?? [];
    return new Map<string, BalanceWithChild>(balances.map((s) => [s.filho_id, s]));
  }, [balancesQuery.data]);

  const handleRefresh = useCallback(async () => {
    await refetchAll();
  }, [refetchAll]);

  const renderContent = () => {
    if (isLoading) {
      return <ListScreenSkeleton />;
    }
    if (error || children.length === 0) {
      return (
        <EmptyState
          error={error?.message}
          empty={children.length === 0}
          emptyMessage={'Nenhum filho cadastrado.\nToque em "+" para cadastrar o primeiro filho.'}
          onRetry={handleRefresh}
        />
      );
    }
    return (
      <FlashList
        data={children}
        keyExtractor={(item) => item.id}
        maintainVisibleContentPosition={{ disabled: true }}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={handleRefresh}
            tintColor={colors.brand.vivid}
          />
        }
        ListHeaderComponent={<View style={{ height: spacing['4'] }} />}
        ListFooterComponent={<View style={{ height: spacing['12'] }} />}
        renderItem={({ item }) => {
          const balance = balancesMap.get(item.id);
          const totalPts = balance ? balance.saldo_livre + balance.cofrinho : 0;
          return (
            <View style={[styles.card, shadows.card, { opacity: item.ativo === false ? 0.5 : 1 }]}>
              <View style={styles.cardRow}>
                <Avatar name={item.nome} size={56} imageUri={item.avatar_url} />

                <View style={styles.cardInfo}>
                  <Text style={styles.cardNome}>{item.nome}</Text>

                  {item.ativo === false && <Text style={styles.inactiveBadge}>Desativado</Text>}

                  <Text
                    style={[
                      styles.cardStatus,
                      {
                        color: item.usuario_id ? colors.semantic.success : colors.semantic.warning,
                      },
                    ]}
                  >
                    {item.usuario_id ? 'Conta vinculada' : 'Sem conta'}
                  </Text>

                  {balance ? (
                    <View style={styles.ptsRow}>
                      <Star size={12} color={colors.brand.vivid} fill={colors.brand.vivid} />
                      <Text style={styles.ptsTotal}>{totalPts} pts</Text>
                      <Text style={styles.ptsBreakdown}>
                        ({balance.saldo_livre} livre · {balance.cofrinho} cofrinho)
                      </Text>
                    </View>
                  ) : null}
                </View>

                <HeaderIconButton
                  icon={Eye}
                  onPress={() => setViewChildId(item.id)}
                  accessibilityLabel={`Ver detalhes de ${item.nome}`}
                />
              </View>
            </View>
          );
        }}
      />
    );
  };

  return (
    <SafeScreenFrame bottomInset>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader
        title="Filhos"
        onBack={() => router.back()}
        rightAction={
          <HeaderIconButton
            icon={Plus}
            onPress={() => setNewSheetVisible(true)}
            accessibilityLabel="Cadastrar filho"
          />
        }
      />

      {renderContent()}

      <ChildViewSheet childId={viewChildId} onClose={() => setViewChildId(null)} />
      <ChildNewSheet visible={newSheetVisible} onClose={() => setNewSheetVisible(false)} />
    </SafeScreenFrame>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    lista: { paddingHorizontal: spacing['4'] },
    card: {
      borderRadius: radii.xl,
      borderWidth: 1,
      padding: spacing['4'],
      marginBottom: spacing['3'],
      backgroundColor: colors.bg.surface,
      borderColor: colors.border.subtle,
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['3'],
    },
    cardInfo: { flex: 1 },
    cardNome: {
      fontSize: typography.size.md,
      fontFamily: typography.family.bold,
      color: colors.text.primary,
    },
    inactiveBadge: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.semibold,
      color: colors.semantic.warningText,
      marginTop: spacing['0.5'],
    },
    cardStatus: { fontSize: typography.size.xs, marginTop: spacing['0.5'] },
    ptsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1'],
      marginTop: spacing['1'],
    },
    ptsTotal: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.bold,
      color: colors.text.primary,
    },
    ptsBreakdown: {
      fontSize: 10,
      color: colors.text.secondary,
    },
  });
}
