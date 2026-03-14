import {
  StyleSheet,
  Text,
  View,
  FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  listarResgatesFilho,
  labelStatusResgate,
  emojiStatusResgate,
  corStatusResgate,
  type ResgateComPremio,
} from '@lib/premios';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';
import { EmptyState } from '@/components/ui/empty-state';
import { formatarData } from '@lib/utils';

export default function FilhoResgatesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [resgates, setResgates] = useState<ResgateComPremio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const hasErro = Boolean(erro);
  const shouldShowEmptyState = carregando || hasErro || resgates.length === 0;
  const emptyStateMessage = 'Nenhum resgate realizado ainda.\nVá ao catálogo e troque seus pontos!';

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const { data, error } = await listarResgatesFilho();
      if (error) setErro(error);
      else setResgates(data);
    } catch {
      setErro('Não foi possível carregar o histórico agora.');
      setResgates([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      <StatusBar style={colors.statusBar} />

      {shouldShowEmptyState ? (
        <EmptyState
          loading={carregando}
          error={erro}
          empty={!carregando && !erro}
          emptyMessage={emptyStateMessage}
          onRetry={carregar}
        />
      ) : (
        <FlatList
          data={resgates}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.lista}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTopo}>
                <Text style={styles.cardNome}>{item.premios.nome}</Text>
                <View style={[styles.statusBadge, { backgroundColor: corStatusResgate(item.status) + '22' }]}>
                  <Text style={[styles.statusTexto, { color: corStatusResgate(item.status) }]}>
                    {emojiStatusResgate(item.status)} {labelStatusResgate(item.status)}
                  </Text>
                </View>
              </View>
              <View style={styles.cardRodape}>
                <Text style={styles.cardPontos}>🏆 {item.pontos_debitados} pts</Text>
                <Text style={styles.cardData}>{formatarData(new Date(item.created_at))}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    lista: { padding: spacing['4'], gap: spacing['2'], paddingBottom: spacing['10'] },
    card: {
      backgroundColor: colors.bg.surface,
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      padding: spacing['4'],
      gap: spacing['2'],
      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
    },
    cardTopo: { flexDirection: 'row', alignItems: 'center', gap: spacing['2'] },
    cardNome: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.text.primary, flex: 1 },
    statusBadge: { borderRadius: radii.md, borderCurve: 'continuous', paddingHorizontal: spacing['2'], paddingVertical: 3 },
    statusTexto: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
    cardRodape: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardPontos: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: colors.accent.filho },
    cardData: { fontSize: typography.size.xs, color: colors.text.muted },
  });
}
