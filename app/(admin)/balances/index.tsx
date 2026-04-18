import { StyleSheet, Text, View, Pressable, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react-native';
import { EmptyState } from '@/components/ui/empty-state';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { Avatar } from '@/components/ui/avatar';
import { useAdminBalances } from '@/hooks/queries';
import { useTheme } from '@/context/theme-context';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { getSafeHorizontalPadding, getSafeTopPadding } from '@lib/safe-area';

export default function BalancesAdminScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(), []);

  const { data: balances = [], isLoading, isFetching, refetch } = useAdminBalances();

  const totalPoints = useMemo(
    () => balances.reduce((sum, b) => sum + b.saldo_livre + b.cofrinho, 0),
    [balances],
  );

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return (
    <SafeScreenFrame bottomInset>
      <StatusBar style={colors.statusBar} />

      <View
        style={[
          styles.header,
          {
            paddingTop: getSafeTopPadding(insets, spacing['3']),
            ...getSafeHorizontalPadding(insets, spacing['5']),
            borderBottomColor: colors.border.subtle,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: colors.bg.muted, opacity: pressed ? 0.8 : 1 },
          ]}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Voltar para Início"
        >
          <ChevronLeft size={16} color={colors.text.primary} strokeWidth={2.5} />
        </Pressable>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Saldos</Text>
          <Text style={[styles.headerSubtitle, { color: colors.text.muted }]}>
            {totalPoints.toLocaleString('pt-BR')} pts no total
          </Text>
        </View>
      </View>

      {isLoading ? (
        <EmptyState loading />
      ) : (
        <FlashList
          data={balances}
          keyExtractor={(s) => s.filho_id}
          contentContainerStyle={styles.lista}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={handleRefresh}
              tintColor={colors.brand.vivid}
            />
          }
          ListEmptyComponent={
            <EmptyState
              empty
              emptyMessage={'Nenhum saldo ainda.\nAprove tarefas para creditar pontos.'}
            />
          }
          renderItem={({ item }) => {
            const total = item.saldo_livre + item.cofrinho;
            const cofrinhoPercent = total > 0 ? Math.round((item.cofrinho / total) * 100) : 0;
            const isInactive = item.filhos.ativo === false;
            return (
              <Pressable
                style={({ pressed }) => {
                  let opacity = 1;
                  if (isInactive) opacity = 0.5;
                  else if (pressed) opacity = 0.9;
                  return [
                    styles.card,
                    shadows.card,
                    {
                      backgroundColor: colors.bg.surface,
                      borderColor: colors.border.subtle,
                      opacity,
                    },
                  ];
                }}
                onPress={() =>
                  router.push({
                    pathname: '/(admin)/balances/[filho_id]',
                    params: { filho_id: item.filho_id, nome: item.filhos.nome },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`${item.filhos.nome}, ${total} pontos, ver saldo`}
              >
                <Avatar name={item.filhos.nome} size={44} imageUri={item.filhos.avatar_url} />
                <View style={styles.cardBody}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.nome, { color: colors.text.primary }]} numberOfLines={1}>
                      {item.filhos.nome}
                    </Text>
                    <Text style={[styles.cardTotal, { color: colors.text.primary }]}>
                      {total.toLocaleString('pt-BR')}{' '}
                      <Text style={[styles.cardTotalUnit, { color: colors.text.muted }]}>pts</Text>
                    </Text>
                  </View>
                  {isInactive ? (
                    <Text style={[styles.inactiveBadge, { color: colors.semantic.warningText }]}>
                      Desativado
                    </Text>
                  ) : null}
                  <View style={styles.breakdownRow}>
                    <Text style={[styles.breakdown, { color: colors.text.muted }]}>
                      {item.saldo_livre} livre
                    </Text>
                    <Text style={[styles.breakdown, { color: colors.text.muted }]}>
                      {item.cofrinho} cofrinho
                    </Text>
                  </View>
                  {total > 0 ? (
                    <View style={[styles.progressTrack, { backgroundColor: colors.bg.muted }]}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${cofrinhoPercent}%`, backgroundColor: colors.accent.admin },
                        ]}
                      />
                    </View>
                  ) : null}
                  {item.indice_valorizacao > 0 ? (
                    <View style={styles.appreciationRow}>
                      <TrendingUp size={12} color={colors.semantic.success} strokeWidth={2} />
                      <Text style={[styles.appreciation, { color: colors.semantic.success }]}>
                        {item.indice_valorizacao}% ao mês
                      </Text>
                    </View>
                  ) : null}
                </View>
                <ChevronRight size={16} color={colors.text.muted} strokeWidth={1.75} />
              </Pressable>
            );
          }}
        />
      )}
    </SafeScreenFrame>
  );
}

function makeStyles() {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['3'],
      paddingBottom: spacing['4'],
      borderBottomWidth: 1,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontFamily: typography.family.extrabold,
      fontSize: typography.size.md,
    },
    headerSubtitle: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.xs,
      marginTop: spacing['0.5'],
    },
    lista: { padding: spacing['5'], paddingBottom: spacing['12'] },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['3'],
      borderRadius: radii.xl,
      borderWidth: 1,
      padding: spacing['4'],
      marginBottom: spacing['3'],
    },
    cardBody: { flex: 1, gap: spacing['1'] },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: spacing['2'],
    },
    nome: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.bold,
      flex: 1,
    },
    cardTotal: {
      fontFamily: typography.family.extrabold,
      fontSize: typography.size.lg,
      fontVariant: ['tabular-nums'],
    },
    cardTotalUnit: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.xs,
    },
    inactiveBadge: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.semibold,
    },
    breakdownRow: {
      flexDirection: 'row',
      gap: spacing['4'],
    },
    breakdown: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.xs,
    },
    progressTrack: {
      height: 6,
      borderRadius: radii.full,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: radii.full,
    },
    appreciationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['0.5'],
    },
    appreciation: {
      fontFamily: typography.family.semibold,
      fontSize: typography.size.xxs,
    },
  });
}
