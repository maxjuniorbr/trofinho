import { StyleSheet, Text, View, Pressable, FlatList } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { listarTarefasAdmin, type TarefaListItem } from '@lib/tarefas';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';

export default function AdminTarefasScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [tarefas, setTarefas] = useState<TarefaListItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const hasErro = Boolean(erro);
  const shouldShowEmptyState = carregando || hasErro || tarefas.length === 0;

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    try {
      const { data, error } = await listarTarefasAdmin();
      if (error) setErro(error); else setTarefas(data);
    } catch { setErro('Não foi possível carregar as tarefas agora.'); setTarefas([]); }
    finally { setCarregando(false); }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader
        title="Tarefas"
        onBack={() => router.back()}
        backLabel="← Início"
        rightAction={
          <Pressable onPress={() => router.push('/(admin)/tarefas/nova')} style={[styles.botaoNova, { backgroundColor: colors.accent.admin }]}>
            <Text style={[styles.botaoNovaTexto, { color: colors.text.inverse }]}>+ Nova</Text>
          </Pressable>
        }
      />

      {shouldShowEmptyState ? (
        <EmptyState loading={carregando} error={erro} empty={tarefas.length === 0} emptyMessage={'Nenhuma tarefa criada ainda.\nToque em "+ Nova" para criar a primeira tarefa.'} onRetry={carregar} />
      ) : (
        <FlatList
          data={tarefas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.lista}
          renderItem={({ item }) => {
            const total = item.atribuicoes.length;
            const pendentes = item.atribuicoes.filter((a) => a.status === 'pendente').length;
            const aguardando = item.atribuicoes.filter((a) => a.status === 'aguardando_validacao').length;
            const aprovadas = item.atribuicoes.filter((a) => a.status === 'aprovada').length;
            return (
              <Pressable
                style={({ pressed }) => [styles.card, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle, boxShadow: colors.shadow.low, opacity: pressed ? 0.9 : 1 }]}
                onPress={() => router.push(`/(admin)/tarefas/${item.id}` as never)}
              >
                <View style={styles.cardTopo}>
                  <Text style={[styles.cardTitulo, { color: colors.text.primary }]} numberOfLines={2}>{item.titulo}</Text>
                  <View style={[styles.pontosTag, { backgroundColor: colors.brand.subtle }]}>
                    <Text style={[styles.pontosTexto, { color: colors.brand.dim }]}>{item.pontos} pts</Text>
                  </View>
                </View>
                <Text style={[styles.cardPrazo, { color: colors.text.muted }]}>Prazo: {item.timebox_fim}</Text>
                <View style={styles.cardStats}>
                  {total === 0 ? (
                    <Text style={[styles.statTexto, { color: colors.text.muted }]}>Sem atribuições</Text>
                  ) : (
                    <>
                      {pendentes > 0 ? <Badge label={`${pendentes} pendente${pendentes > 1 ? 's' : ''}`} variant="warning" /> : null}
                      {aguardando > 0 ? <Badge label={`${aguardando} validar`} variant="info" /> : null}
                      {aprovadas > 0 ? <Badge label={`${aprovadas} aprovada${aprovadas > 1 ? 's' : ''}`} variant="success" /> : null}
                    </>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    botaoNova: { borderRadius: radii.sm, paddingVertical: spacing['1'] + 2, paddingHorizontal: spacing['3'] },
    botaoNovaTexto: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
    lista: { padding: spacing['4'], paddingBottom: spacing['10'], gap: 10 },
    card: { borderRadius: radii.lg, borderWidth: 1, padding: spacing['4'] },
    cardTopo: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing['2'] },
    cardTitulo: { flex: 1, fontSize: typography.size.md, fontWeight: typography.weight.semibold, marginRight: spacing['2'] },
    pontosTag: { borderRadius: radii.full, paddingHorizontal: spacing['2'], paddingVertical: 3 },
    pontosTexto: { fontSize: typography.size.xs, fontWeight: typography.weight.bold },
    cardPrazo: { fontSize: typography.size.xs, marginBottom: spacing['2'] },
    cardStats: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    statTexto: { fontSize: typography.size.xs },
  });
}
