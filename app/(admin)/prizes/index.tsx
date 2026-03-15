import {
  StyleSheet,
  Text,
  View,
  Pressable,
  FlatList,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { listPrizes, type Prize } from '@lib/prizes';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';

export default function AdminPrizesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await listPrizes();
      if (error) setError(error);
      else setPrizes(data);
    } catch {
      setError('Não foi possível carregar os prêmios agora.');
      setPrizes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const active = prizes.filter((p) => p.ativo);
  const inactive = prizes.filter((p) => !p.ativo);
  const hasError = Boolean(error);
  const shouldShowEmptyState = loading || hasError || prizes.length === 0;
  const emptyStateMessage = 'Nenhum prêmio cadastrado.\nToque em "+ Novo" para criar o primeiro prêmio.';
  const inactivePlural = inactive.length === 1 ? '' : 's';
  const inactiveSummary = inactive.length > 0
    ? ` · ${inactive.length} inativo${inactivePlural}`
    : '';

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader
        title="Prêmios"
        onBack={() => router.back()}
        backLabel="Início"
        rightAction={
          <Pressable
            onPress={() => router.push('/(admin)/prizes/new' as never)}
            style={[styles.botaoNova, { backgroundColor: colors.accent.admin }]}
          >
            <Text style={[styles.botaoNovaTexto, { color: colors.text.inverse }]}>+ Novo</Text>
          </Pressable>
        }
      />

      {shouldShowEmptyState ? (
        <EmptyState
          loading={loading}
          error={error}
          empty={!loading && !error}
          emptyMessage={emptyStateMessage}
          onRetry={loadData}
        />
      ) : (
        <FlatList
          data={prizes}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.lista}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={colors.brand.vivid} />}
          ListHeaderComponent={
            <Text style={styles.resumo}>
              {active.length} ativo{active.length === 1 ? '' : 's'}
              {inactiveSummary}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.card,
                !item.ativo && styles.cardInativo,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => router.push(`/(admin)/prizes/${item.id}` as never)}
              accessibilityRole="button"
              accessibilityLabel={`${item.nome}, ${item.custo_pontos} pontos${item.ativo ? '' : ', inativo'}`}
            >
              <View style={styles.cardTopo}>
                <Text style={[styles.cardNome, !item.ativo && styles.textoInativo]}>{item.nome}</Text>
                {!item.ativo && (
                  <View style={styles.badgeInativo}>
                    <Text style={styles.badgeInativoTexto}>inativo</Text>
                  </View>
                )}
              </View>
              {item.descricao ? (
                <Text style={[styles.cardDescricao, !item.ativo && styles.textoInativo]} numberOfLines={2}>
                  {item.descricao}
                </Text>
              ) : null}
              <Text style={[styles.cardCusto, !item.ativo && styles.textoInativo]}>
                🏆 {item.custo_pontos} pts
              </Text>
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
    lista: { padding: spacing['4'], gap: spacing['3'], paddingBottom: spacing['12'] },
    resumo: { fontSize: typography.size.xs, color: colors.text.muted, marginBottom: spacing['1'] },
    card: {
      backgroundColor: colors.bg.surface,
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      padding: spacing['4'],
      gap: spacing['2'],
      ...shadows.card,
    },
    cardInativo: { opacity: 0.55 },
    cardTopo: { flexDirection: 'row', alignItems: 'center', gap: spacing['2'] },
    cardNome: { fontSize: typography.size.md, fontFamily: typography.family.semibold, color: colors.text.primary, flex: 1 },
    textoInativo: { color: colors.text.muted },
    cardDescricao: { fontSize: typography.size.sm, color: colors.text.secondary },
    cardCusto: { fontSize: typography.size.xs, fontFamily: typography.family.bold, color: colors.accent.admin },
    badgeInativo: {
      backgroundColor: colors.bg.muted,
      borderRadius: radii.md,
      paddingHorizontal: spacing['2'],
      paddingVertical: spacing['1'],
    },
    badgeInativoTexto: { fontSize: typography.size.xs, color: colors.text.muted, fontFamily: typography.family.semibold },
    botaoNova: { borderRadius: radii.sm, paddingVertical: spacing['2'], paddingHorizontal: spacing['3'], minHeight: 36 },
    botaoNovaTexto: { fontSize: typography.size.sm, fontFamily: typography.family.semibold },
    botaoNovoTexto: { fontSize: typography.size.sm, fontFamily: typography.family.semibold },
  });
}
