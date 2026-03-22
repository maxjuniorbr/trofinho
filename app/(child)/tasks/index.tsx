import {
  StyleSheet,
  Text,
  View,
  Pressable,
  RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { RefreshCw } from 'lucide-react-native';
import {
  getAssignmentPoints,
  listChildAssignments,
  renewDailyTasks,
  type ChildAssignment,
  type AssignmentStatus,
} from '@lib/tasks';
import { getAssignmentStatusColor, getAssignmentStatusLabel } from '@/constants/status';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';

type Filter = 'pendente' | 'aguardando_validacao' | 'historico';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'pendente', label: 'Pendentes' },
  { key: 'aguardando_validacao', label: 'Em validação' },
  { key: 'historico', label: 'Histórico' },
];

function belongsToFilter(status: AssignmentStatus, filter: Filter): boolean {
  if (filter === 'historico') return status === 'aprovada' || status === 'rejeitada';
  return status === filter;
}

export default function ChildTasksScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [assignments, setAssignments] = useState<ChildAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('pendente');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [, { data, error }] = await Promise.all([
        renewDailyTasks(),
        listChildAssignments(),
      ]);
      if (error) setError(error);
      else setAssignments(data);
    } catch {
      setError('Não foi possível carregar suas tarefas agora.');
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const filtered = assignments.filter((a) => belongsToFilter(a.status, filter));
  let emptyMessage = 'Nenhuma tarefa concluída ainda.';

  if (filter === 'pendente') {
    emptyMessage = 'Nenhuma tarefa pendente.';
  } else if (filter === 'aguardando_validacao') {
    emptyMessage = 'Nada aguardando validação.';
  }

  const shouldShowEmptyState = loading || Boolean(error) || filtered.length === 0;

  return (
    <SafeScreenFrame bottomInset>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Minhas Tarefas" onBack={() => router.back()} backLabel="Início" role="filho" />

      <View style={styles.filtersRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && [styles.filterTextActive, { color: colors.text.inverse }]]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {shouldShowEmptyState ? (
        <EmptyState
          loading={loading}
          error={error}
          empty={!loading && !error}
          emptyMessage={emptyMessage}
          onRetry={loadData}
        />
      ) : (
        <FlashList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={colors.brand.vivid} />}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/(child)/tasks/${item.id}` as never)}
            >
              <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.tarefas.titulo}</Text>
                <View style={styles.pointsTag}>
                  <Text style={styles.pointsText}>{getAssignmentPoints(item)} pts</Text>
                </View>
              </View>
              <View style={styles.freqRow}>
                {item.tarefas.frequencia === 'diaria' ? (
                  <RefreshCw size={12} color={colors.text.muted} strokeWidth={2} />
                ) : null}
                <Text style={styles.cardDeadline}>
                  {item.tarefas.frequencia === 'diaria' ? 'Diária' : 'Única'}
                </Text>
              </View>
              <View style={[styles.statusTag, { backgroundColor: getAssignmentStatusColor(item.status, colors) + '20' }]}>
                <Text style={[styles.statusText, { color: getAssignmentStatusColor(item.status, colors) }]}>
                  {getAssignmentStatusLabel(item.status)}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeScreenFrame>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    filtersRow: {
      flexDirection: 'row',
      backgroundColor: colors.bg.surface,
      paddingHorizontal: spacing['4'],
      paddingBottom: spacing['3'],
      gap: spacing['2'],
      borderBottomWidth: 1,
      borderBottomColor: colors.border.default,
    },
    filterBtn: {
      flex: 1,
      paddingVertical: spacing['2'],
      borderRadius: radii.md,
      alignItems: 'center',
      backgroundColor: colors.accent.filhoBg,
      minHeight: 44,
      justifyContent: 'center',
    },
    filterBtnActive: { backgroundColor: colors.accent.filho },
    filterText: { fontSize: typography.size.xs, fontFamily: typography.family.semibold, color: colors.text.secondary },
    filterTextActive: {},
    list: { padding: spacing['4'], paddingBottom: spacing['12'] },
    card: {
      backgroundColor: colors.bg.surface,
      borderRadius: radii.xl,
      padding: spacing['4'],
      marginBottom: spacing['3'],
      ...shadows.card,
    },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing['2'] },
    cardTitle: { flex: 1, fontSize: typography.size.md, fontFamily: typography.family.semibold, color: colors.text.primary, marginRight: spacing['2'] },
    pointsTag: { backgroundColor: colors.accent.filhoBg, borderRadius: radii.sm, paddingVertical: spacing['1'], paddingHorizontal: spacing['2'] },
    pointsText: { fontSize: typography.size.xs, fontFamily: typography.family.bold, color: colors.accent.filho },
    freqRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'], marginBottom: spacing['2'] },
    cardDeadline: { fontSize: typography.size.xs, color: colors.text.muted },
    statusTag: { borderRadius: radii.sm, paddingVertical: spacing['1'], paddingHorizontal: spacing['2'], alignSelf: 'flex-start' },
    statusText: { fontSize: typography.size.xs, fontFamily: typography.family.semibold },
  });
}
