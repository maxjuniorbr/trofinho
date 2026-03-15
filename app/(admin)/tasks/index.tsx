import { StyleSheet, Text, View, Pressable, FlatList, RefreshControl } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { listAdminTasks, type TaskListItem } from '@lib/tasks';
import { useTheme } from '@/context/theme-context';
import { radii, shadows, spacing, typography } from '@/constants/theme';

export default function AdminTasksScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);

  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasError = Boolean(error);
  const shouldShowEmptyState = loading || hasError || tasks.length === 0;

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data, error } = await listAdminTasks();
      if (error) setError(error); else setTasks(data);
    } catch { setError('Não foi possível carregar as tarefas agora.'); setTasks([]); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader
        title="Tarefas"
        onBack={() => router.back()}
        backLabel="Início"
        rightAction={
          <Pressable onPress={() => router.push('/(admin)/tasks/new')} style={[styles.botaoNova, { backgroundColor: colors.accent.admin }]}>
            <Text style={[styles.botaoNovaTexto, { color: colors.text.inverse }]}>+</Text>
          </Pressable>
        }
      />

      {shouldShowEmptyState ? (
        <EmptyState loading={loading} error={error} empty={tasks.length === 0} emptyMessage={'Nenhuma tarefa criada ainda.\nToque em "+" para criar a primeira tarefa.'} onRetry={loadData} />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.lista}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={colors.brand.vivid} />}
          renderItem={({ item }) => {
            const total = item.atribuicoes.length;
            const pendentes = item.atribuicoes.filter((a) => a.status === 'pendente').length;
            const aguardando = item.atribuicoes.filter((a) => a.status === 'aguardando_validacao').length;
            const aprovadas = item.atribuicoes.filter((a) => a.status === 'aprovada').length;
            return (
              <Pressable
                style={({ pressed }) => [styles.card, shadows.card, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle, opacity: pressed ? 0.9 : 1 }]}
                onPress={() => router.push(`/(admin)/tasks/${item.id}` as never)}
              >
                <View style={styles.cardTopo}>
                  <Text style={[styles.cardTitulo, { color: colors.text.primary }]} numberOfLines={2}>{item.titulo}</Text>
                  <View style={[styles.pontosTag, { backgroundColor: colors.brand.subtle }]}>
                    <Text style={[styles.pontosTexto, { color: colors.brand.dim }]}>{item.pontos} pts</Text>
                  </View>
                </View>
                <Text style={[styles.cardPrazo, { color: colors.text.muted }]}>
                  {item.frequencia === 'diaria' ? '🔁 Diária' : '1️⃣ Única'}
                </Text>
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

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1 },
    botaoNova: { alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: radii.md },
    botaoNovaTexto: { fontSize: 22, fontFamily: typography.family.black, textAlign: 'center', includeFontPadding: false },
    lista: { padding: spacing['4'], paddingBottom: spacing['10'], gap: spacing['3'] },
    card: { borderRadius: radii.xl, borderWidth: 1, padding: spacing['4'] },
    cardTopo: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing['2'] },
    cardTitulo: { flex: 1, fontSize: typography.size.md, fontFamily: typography.family.semibold, marginRight: spacing['2'] },
    pontosTag: { borderRadius: radii.full, paddingHorizontal: spacing['2'], paddingVertical: spacing['1'] },
    pontosTexto: { fontSize: typography.size.xs, fontFamily: typography.family.bold },
    cardPrazo: { fontSize: typography.size.xs, marginBottom: spacing['2'] },
    cardStats: { flexDirection: 'row', gap: spacing['2'], flexWrap: 'wrap' },
    statTexto: { fontSize: typography.size.xs },
  });
}
