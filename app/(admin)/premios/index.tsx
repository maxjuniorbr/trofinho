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
import { radii, spacing, typography } from '@/constants/theme';
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

      {carregando || erro || premios.length === 0 ? (
        <EmptyState
          loading={carregando}
          error={erro ? erro ?? 'Nenhum prêmio cadastrado.\nToque em "+ Novo" para criar o primeiro prêmio.' : null}
          empty={!carregando && !erro}
          emptyMessage={erro ?? 'Nenhum prêmio cadastrado.\nToque em "+ Novo" para criar o primeiro prêmio.'}
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
              {inativos.length > 0 ? ` · ${inativos.length} inativo${inativos.length !== 1 ? 's' : ''}` : ''}
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
      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
    },
    cardInativo: { opacity: 0.55 },
    cardTopo: { flexDirection: 'row', alignItems: 'center', gap: spacing['2'] },
    cardNome: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.text.primary, flex: 1 },
    textoInativo: { color: colors.text.muted },
    cardDescricao: { fontSize: typography.size.sm, color: colors.text.secondary },
    cardCusto: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: colors.accent.admin },
    badgeInativo: {
      backgroundColor: colors.bg.muted,
      borderRadius: radii.md,
      paddingHorizontal: spacing['2'],
      paddingVertical: 2,
    },
    badgeInativoTexto: { fontSize: typography.size.xs, color: colors.text.muted, fontWeight: typography.weight.semibold },
    botaoNova: { borderRadius: radii.sm, paddingVertical: spacing['1'] + 2, paddingHorizontal: spacing['3'] },
    botaoNovaTexto: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  });
}
