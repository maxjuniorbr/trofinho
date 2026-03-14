import { StyleSheet, Text, View, Pressable, FlatList } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar } from '@/components/ui/avatar';
import { listarSaldosAdmin, type SaldoComFilho } from '@lib/saldos';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';

export default function SaldosAdminScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [itens, setItens] = useState<SaldoComFilho[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try { const { data } = await listarSaldosAdmin(); setItens(data); }
    finally { setCarregando(false); }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Saldos dos Filhos" onBack={() => router.back()} backLabel="← Início" />

      {carregando ? (
        <EmptyState loading />
      ) : (
        <FlatList
          data={itens}
          keyExtractor={(s) => s.filho_id}
          contentContainerStyle={styles.lista}
          ListEmptyComponent={<EmptyState empty emptyMessage={'Nenhum saldo ainda.\nAprove tarefas para creditar pontos.'} />}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle, boxShadow: colors.shadow.low, opacity: pressed ? 0.9 : 1 }]}
              onPress={() => router.push({ pathname: '/(admin)/saldos/[filho_id]', params: { filho_id: item.filho_id, nome: item.filhos.nome } })}
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

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    lista: { padding: spacing['5'], paddingBottom: spacing['12'] },
    card: { flexDirection: 'row', alignItems: 'center', borderRadius: radii.lg, borderWidth: 1, padding: spacing['4'], marginBottom: 10 },
    info: { flex: 1, marginLeft: spacing['3'] },
    nome: { fontSize: typography.size.md, fontWeight: typography.weight.bold },
    detalhe: { fontSize: typography.size.sm, marginTop: 3 },
    seta: { fontSize: 22 },
  });
}
