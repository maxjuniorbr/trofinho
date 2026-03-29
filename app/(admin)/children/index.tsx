import { StyleSheet, Text, View, Pressable, FlatList, RefreshControl } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Eye, Plus } from 'lucide-react-native';
import { HeaderIconButton, ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { Avatar } from '@/components/ui/avatar';
import { useChildrenList, useAdminBalances, combineQueryStates } from '@/hooks/queries';
import { syncAutomaticAppreciation } from '@lib/balances';
import type { BalanceWithChild } from '@lib/balances';
import { useTheme } from '@/context/theme-context';
import { radii, shadows, spacing, typography } from '@/constants/theme';

export default function AdminChildrenScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);

  const childrenQuery = useChildrenList();
  const balancesQuery = useAdminBalances();
  const { isLoading, isFetching, error, refetchAll } = combineQueryStates(childrenQuery, balancesQuery);

  const children = childrenQuery.data ?? [];
  const balancesMap = useMemo(() => {
    const balances = balancesQuery.data ?? [];
    return new Map<string, BalanceWithChild>(balances.map((s) => [s.filho_id, s]));
  }, [balancesQuery.data]);

  const handleRefresh = useCallback(async () => {
    try {
      await syncAutomaticAppreciation();
    } catch (e) {
      console.error(e);
    }
    await refetchAll();
  }, [refetchAll]);

  return (
    <SafeScreenFrame bottomInset>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader
        title="Filhos"
        onBack={() => router.back()}
        backLabel="Início"
        rightAction={
          <HeaderIconButton
            icon={Plus}
            onPress={() => router.push('/(admin)/children/new')}
            accessibilityLabel="Cadastrar filho"
          />
        }
      />

      {(isLoading || error || children.length === 0) ? (
        <EmptyState loading={isLoading} error={error?.message} empty={children.length === 0} emptyMessage={'Nenhum filho cadastrado.\nToque em "+" para cadastrar o primeiro filho.'} onRetry={handleRefresh} />
      ) : (
        <FlatList
          data={children}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.lista}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={handleRefresh} tintColor={colors.brand.vivid} />}
          renderItem={({ item }) => {
            const balance = balancesMap.get(item.id);
            return (
              <View style={[styles.card, shadows.card, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle, opacity: item.ativo === false ? 0.5 : 1 }]}>
                <Pressable
                  style={styles.cardMain}
                  onPress={() => router.push(`/(admin)/children/${item.id}` as never)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.nome}, ver nome e e-mail`}
                >
                  <Avatar name={item.nome} size={44} imageUri={item.avatar_url} />
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardNome, { color: colors.text.primary }]}>{item.nome}</Text>
                    {item.ativo === false && (
                      <Text style={[styles.inactiveBadge, { color: colors.semantic.warningText }]}>Desativado</Text>
                    )}
                    <Text style={[styles.cardStatus, { color: item.usuario_id ? colors.semantic.success : colors.semantic.warning }]}>
                      {item.usuario_id ? 'Conta vinculada' : 'Sem conta'}
                    </Text>
                    {balance ? (
                      <Text style={[styles.cardSaldo, { color: colors.text.secondary }]}>
                        {balance.saldo_livre} livre · {balance.cofrinho} cofrinho
                      </Text>
                    ) : null}
                  </View>
                </Pressable>

                <HeaderIconButton
                  icon={Eye}
                  onPress={() => router.push(`/(admin)/children/${item.id}` as never)}
                  accessibilityLabel={`Ver dados de ${item.nome}`}
                />
              </View>
            );
          }}
        />
      )}
    </SafeScreenFrame>
  );
}

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1 },
    lista: { padding: spacing['4'], gap: spacing['3'], paddingBottom: spacing['12'] },
    card: {
      borderRadius: radii.xl,
      borderWidth: 1,
      padding: spacing['3'],
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing['3'],
    },
    cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    cardInfo: { flex: 1, marginLeft: spacing['3'] },
    cardNome: { fontSize: typography.size.md, fontFamily: typography.family.semibold },
    inactiveBadge: { fontSize: typography.size.xs, fontFamily: typography.family.semibold, marginTop: spacing['0.5'] },
    cardStatus: { fontSize: typography.size.xs, marginTop: spacing['1'] },
    cardSaldo: { fontSize: typography.size.xs, marginTop: spacing['1'] },
  });
}
