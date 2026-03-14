import {
  StyleSheet,
  Text,
  View,
  Pressable,
  FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { listarPremios, type Premio } from '@lib/premios';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';

export default function AdminPremiosScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [premios, setPremios] = useState<Premio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const { data, error } = await listarPremios();
      if (error) setErro(error);
      else setPremios(data);
    } catch {
      setErro('Não foi possível carregar os prêmios agora.');
      setPremios([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const ativos = premios.filter((p) => p.ativo);
  const inativos = premios.filter((p) => !p.ativo);
  const hasErro = Boolean(erro);
  const shouldShowEmptyState = carregando || hasErro || premios.length === 0;
  const emptyStateMessage = 'Nenhum prêmio cadastrado.\nToque em "+ Novo" para criar o primeiro prêmio.';
  const resumoInativos = inativos.length > 0
    ? ` · ${inativos.length} inativo${inativos.length !== 1 ? 's' : ''}`
    : '';

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader
        title="Prêmios"
        rightAction={
          <Pressable
            onPress={() => router.push('/(admin)/premios/novo' as never)}
            style={[styles.botaoNova, { backgroundColor: colors.accent.admin }]}
          >
            <Text style={[styles.botaoNovaTexto, { color: colors.text.inverse }]}>+ Novo</Text>
          </Pressable>
        }
      />

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
          data={premios}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.lista}
          ListHeaderComponent={
            <Text style={styles.resumo}>
              {ativos.length} ativo{ativos.length !== 1 ? 's' : ''}
              {resumoInativos}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.card,
                !item.ativo && styles.cardInativo,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => router.push(`/(admin)/premios/${item.id}` as never)}
              accessibilityRole="button"
              accessibilityLabel={`${item.nome}, ${item.custo_pontos} pontos${!item.ativo ? ', inativo' : ''}`}
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
    lista: { padding: spacing['4'], gap: spacing['3'], paddingBottom: 96 },
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
      paddingVertical: 2,
    },
    badgeInativoTexto: { fontSize: typography.size.xs, color: colors.text.muted, fontFamily: typography.family.semibold },
    botaoNova: { borderRadius: radii.sm, paddingVertical: spacing['1'] + 2, paddingHorizontal: spacing['3'] },
    botaoNovaTexto: { fontSize: typography.size.sm, fontFamily: typography.family.semibold },
  });
}
