import { StyleSheet, Text, View, Pressable, FlatList, RefreshControl } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar } from '@/components/ui/avatar';
import { listAdminBalances, type BalanceWithChild } from '@lib/balances';
import { useTheme } from '@/context/theme-context';
import { radii, shadows, spacing, typography } from '@/constants/theme';

export default function BalancesAdminScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);

  const [balances, setBalances] = useState<BalanceWithChild[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try { const { data } = await listAdminBalances(); setBalances(data); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Saldos dos Filhos" onBack={() => router.back()} backLabel="Início" />

      {loading ? (
        <EmptyState loading />
      ) : (
        <FlatList
          data={balances}
          keyExtractor={(s) => s.filho_id}
          contentContainerStyle={styles.lista}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={colors.brand.vivid} />}
          ListEmptyComponent={<EmptyState empty emptyMessage={'Nenhum saldo ainda.\nAprove tarefas para creditar pontos.'} />}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, shadows.card, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle, opacity: pressed ? 0.9 : 1 }]}
              onPress={() => router.push({ pathname: '/(admin)/balances/[filho_id]', params: { filho_id: item.filho_id, nome: item.filhos.nome } })}
            >
              <Avatar name={item.filhos.nome} size={44} />
              <View style={styles.info}>
                <Text style={[styles.nome, { color: colors.text.primary }]}>{item.filhos.nome}</Text>
                <Text style={[styles.detalhe, { color: colors.text.secondary }]}>
                  💰 {item.saldo_livre} livre · 🐷 {item.cofrinho} cofrinho
                </Text>
                {item.indice_valorizacao > 0 && (
                  <Text style={[styles.detalhe, { color: colors.text.muted }]}>📈 {item.indice_valorizacao}%/{item.periodo_valorizacao}</Text>
                )}
              </View>
              <Text style={[styles.seta, { color: colors.text.muted }]}>›</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1 },
    lista: { padding: spacing['5'], paddingBottom: spacing['12'] },
    card: { flexDirection: 'row', alignItems: 'center', borderRadius: radii.xl, borderWidth: 1, padding: spacing['4'], marginBottom: spacing['3'] },
    info: { flex: 1, marginLeft: spacing['3'] },
    nome: { fontSize: typography.size.md, fontFamily: typography.family.bold },
    detalhe: { fontSize: typography.size.sm, marginTop: spacing['1'] },
    seta: { fontSize: 22 },
  });
}
