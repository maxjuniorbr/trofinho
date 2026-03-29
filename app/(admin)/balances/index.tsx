import { StyleSheet, Text, View, Pressable, FlatList, RefreshControl } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { Avatar } from '@/components/ui/avatar';
import { useAdminBalances } from '@/hooks/queries';
import { syncAutomaticAppreciation } from '@lib/balances';
import { captureException } from '@lib/sentry';
import { useTheme } from '@/context/theme-context';
import { radii, shadows, spacing, typography } from '@/constants/theme';

export default function BalancesAdminScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);

  const { data: balances = [], isLoading, isFetching, refetch } = useAdminBalances();

  const handleRefresh = useCallback(async () => {
    try {
      await syncAutomaticAppreciation();
    } catch (e) {
      captureException(e);
    }
    await refetch();
  }, [refetch]);

  return (
    <SafeScreenFrame bottomInset>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Saldos dos Filhos" onBack={() => router.back()} backLabel="Início" />

      {isLoading ? (
        <EmptyState loading />
      ) : (
        <FlatList
          data={balances}
          keyExtractor={(s) => s.filho_id}
          contentContainerStyle={styles.lista}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={handleRefresh} tintColor={colors.brand.vivid} />}
          ListEmptyComponent={<EmptyState empty emptyMessage={'Nenhum saldo ainda.\nAprove tarefas para creditar pontos.'} />}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, shadows.card, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle, opacity: item.filhos.ativo === false ? 0.5 : pressed ? 0.9 : 1 }]}
              onPress={() => router.push({ pathname: '/(admin)/balances/[filho_id]', params: { filho_id: item.filho_id, nome: item.filhos.nome } })}
            >
              <Avatar name={item.filhos.nome} size={44} />
              <View style={styles.info}>
                <Text style={[styles.nome, { color: colors.text.primary }]}>{item.filhos.nome}</Text>
                {item.filhos.ativo === false && (
                  <Text style={[styles.inactiveBadge, { color: colors.semantic.warningText }]}>Desativado</Text>
                )}
                <Text style={[styles.detalhe, { color: colors.text.secondary }]}>
                  {item.saldo_livre} livre · {item.cofrinho} cofrinho
                </Text>
                {item.indice_valorizacao > 0 && (
                  <Text style={[styles.detalhe, { color: colors.text.muted }]}>{item.indice_valorizacao}%/{item.periodo_valorizacao}</Text>
                )}
              </View>
              <ChevronRight size={20} color={colors.text.muted} strokeWidth={2} />
            </Pressable>
          )}
        />
      )}
    </SafeScreenFrame>
  );
}

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1 },
    lista: { padding: spacing['5'], paddingBottom: spacing['12'] },
    card: { flexDirection: 'row', alignItems: 'center', borderRadius: radii.xl, borderWidth: 1, padding: spacing['4'], marginBottom: spacing['3'] },
    info: { flex: 1, marginLeft: spacing['3'] },
    nome: { fontSize: typography.size.md, fontFamily: typography.family.bold },
    inactiveBadge: { fontSize: typography.size.xs, fontFamily: typography.family.semibold, marginTop: spacing['0.5'] },
    detalhe: { fontSize: typography.size.sm, marginTop: spacing['1'] },
  });
}
