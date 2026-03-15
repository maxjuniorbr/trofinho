import { StyleSheet, Text, View, Pressable, FlatList, RefreshControl } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar } from '@/components/ui/avatar';
import { listChildren } from '@lib/children';
import { listAdminBalances, type BalanceWithChild } from '@lib/balances';
import type { Child } from '@lib/tasks';
import { useTheme } from '@/context/theme-context';
import { radii, shadows, spacing, typography } from '@/constants/theme';

export default function AdminChildrenScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);

  const [children, setChildren] = useState<Child[]>([]);
  const [balancesMap, setBalancesMap] = useState<Map<string, BalanceWithChild>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [{ data: childrenData, error: childrenError }, { data: balancesData, error: balancesError }] =
        await Promise.all([listChildren(), listAdminBalances()]);
      if (childrenError) {
        setError(childrenError);
      } else {
        setChildren(childrenData);
        if (!balancesError) {
          setBalancesMap(new Map(balancesData.map((s) => [s.filho_id, s])));
        }
      }
    } catch { setError('Não foi possível carregar os filhos agora.'); setChildren([]); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader
        title="Filhos"
        onBack={() => router.back()}
        backLabel="Início"
        rightAction={
          <Pressable onPress={() => router.push('/(admin)/children/new')} style={[styles.botaoNovo, { backgroundColor: colors.accent.admin }]}>
            <Text style={[styles.botaoNovoTexto, { color: colors.text.inverse }]}>+ Novo</Text>
          </Pressable>
        }
      />

      {(loading || error || children.length === 0) ? (
        <EmptyState loading={loading} error={error} empty={children.length === 0} emptyMessage={'Nenhum filho cadastrado.\nToque em "+ Novo" para cadastrar o primeiro filho.'} onRetry={loadData} />
      ) : (
        <FlatList
          data={children}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.lista}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={colors.brand.vivid} />}
          renderItem={({ item }) => {
            const balance = balancesMap.get(item.id);
            return (
              <Pressable
                style={[styles.card, shadows.card, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}
                onPress={() => router.push(`/(admin)/balances/${item.id}` as never)}
                accessibilityRole="button"
                accessibilityLabel={`${item.nome}, ver saldo`}
              >
                <Avatar name={item.nome} size={44} />
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardNome, { color: colors.text.primary }]}>{item.nome}</Text>
                  <Text style={[styles.cardStatus, { color: item.usuario_id ? colors.semantic.success : colors.semantic.warning }]}>
                    {item.usuario_id ? '✓ Conta vinculada' : '⚠ Sem conta'}
                  </Text>
                  {balance ? (
                    <Text style={[styles.cardSaldo, { color: colors.text.secondary }]}>
                      💰 {balance.saldo_livre} livre · 🐷 {balance.cofrinho} cofrinho
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1 },
    botaoNovo: { borderRadius: radii.sm, paddingVertical: spacing['2'], paddingHorizontal: spacing['3'], minHeight: 36 },
    botaoNovoTexto: { fontSize: typography.size.sm, fontFamily: typography.family.semibold },
    lista: { padding: spacing['4'], gap: spacing['3'] },
    card: { borderRadius: radii.xl, borderWidth: 1, padding: spacing['3'], flexDirection: 'row', alignItems: 'center' },
    cardInfo: { flex: 1, marginLeft: spacing['3'] },
    cardNome: { fontSize: typography.size.md, fontFamily: typography.family.semibold },
    cardStatus: { fontSize: typography.size.xs, marginTop: spacing['1'] },
    cardSaldo: { fontSize: typography.size.xs, marginTop: spacing['1'] },
  });
}
