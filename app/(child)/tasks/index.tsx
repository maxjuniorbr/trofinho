import {
  StyleSheet,
  Text,
  View,
  Pressable,
  RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { useState, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { RefreshCw } from 'lucide-react-native';
import {
  getAssignmentPoints,
  type ChildAssignment,
  type AssignmentStatus,
} from '@lib/tasks';
import { formatDate } from '@lib/utils';
import { getAssignmentStatusColor, getAssignmentStatusLabel } from '@/constants/status';
import { useChildAssignments } from '@/hooks/queries';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { SegmentedBar, type SegmentOption } from '@/components/ui/segmented-bar';

type Filter = 'pendente' | 'aguardando_validacao' | 'historico';

const FILTERS: SegmentOption<Filter>[] = [
  { key: 'pendente', label: 'Pendentes' },
  { key: 'aguardando_validacao', label: 'Em validação' },
  { key: 'historico', label: 'Histórico' },
];

function belongsToFilter(status: AssignmentStatus, filter: Filter): boolean {
  if (filter === 'historico') return status === 'aprovada' || status === 'rejeitada';
  return status === filter;
}

function sortChildAssignments(assignments: ChildAssignment[], filter: Filter): ChildAssignment[] {
  const arr = assignments.slice();
  if (filter === 'pendente') {
    return arr.sort((a, b) => getAssignmentPoints(b) - getAssignmentPoints(a));
  }
  if (filter === 'aguardando_validacao') {
    return arr.sort((a, b) => {
      const aTime = a.concluida_em ?? a.created_at;
      const bTime = b.concluida_em ?? b.created_at;
      return bTime.localeCompare(aTime);
    });
  }
  return arr.sort((a, b) => {
    const aTime = a.validada_em ?? a.concluida_em ?? a.created_at;
    const bTime = b.validada_em ?? b.concluida_em ?? b.created_at;
    return bTime.localeCompare(aTime);
  });
}

type DateLine = { label: string; value: string };

function getAssignmentDateLine(assignment: ChildAssignment, filter: Filter): DateLine | null {
  if (filter === 'pendente') return null;
  if (filter === 'aguardando_validacao') {
    return assignment.concluida_em
      ? { label: 'Enviada em ', value: formatDate(assignment.concluida_em) }
      : null;
  }
  const date = assignment.validada_em ?? assignment.concluida_em;
  if (!date) return null;
  return {
    label: assignment.validada_em ? 'Validada em ' : 'Concluída em ',
    value: formatDate(date),
  };
}

export default function ChildTasksScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data: assignments = [], isLoading, error, refetch } = useChildAssignments();
  const [filter, setFilter] = useState<Filter>('pendente');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = useMemo(
    () => sortChildAssignments(assignments.filter((a) => belongsToFilter(a.status, filter)), filter),
    [assignments, filter],
  );

  let emptyMessage = 'Nenhuma tarefa concluída ainda.';
  if (filter === 'pendente') emptyMessage = 'Nenhuma tarefa pendente.';
  else if (filter === 'aguardando_validacao') emptyMessage = 'Nada aguardando validação.';

  const loading = isLoading;
  const errorMessage = error?.message ?? null;
  const shouldShowEmptyState = loading || Boolean(errorMessage) || filtered.length === 0;

  return (
    <SafeScreenFrame bottomInset>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Minhas Tarefas" onBack={() => router.back()} backLabel="Início" role="filho" />

      <SegmentedBar
        options={FILTERS}
        value={filter}
        onChange={setFilter}
        role="filho"
      />

      {shouldShowEmptyState ? (
        <EmptyState
          loading={loading}
          error={errorMessage}
          empty={!loading && !errorMessage}
          emptyMessage={emptyMessage}
          onRetry={handleRefresh}
        />
      ) : (
        <FlashList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.brand.vivid} />}
          renderItem={({ item }) => {
            const dateLine = getAssignmentDateLine(item, filter);
            return (
              <Pressable
                style={styles.card}
                onPress={() => router.push(`/(child)/tasks/${item.id}` as never)}
                accessibilityRole="button"
                accessibilityLabel={`Ver detalhes da tarefa ${item.tarefas.titulo}`}
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
                {dateLine ? (
                  <Text style={styles.cardDeadline}>{dateLine.label}{dateLine.value}</Text>
                ) : null}
                {filter === 'historico' ? (
                  <View style={[styles.statusTag, { backgroundColor: getAssignmentStatusColor(item.status, colors) + '20' }]}>
                    <Text style={[styles.statusText, { color: getAssignmentStatusColor(item.status, colors) }]}>
                      {getAssignmentStatusLabel(item.status)}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}
    </SafeScreenFrame>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
    freqRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'], marginBottom: spacing['1'] },
    cardDeadline: { fontSize: typography.size.xs, color: colors.text.muted, marginBottom: spacing['2'] },
    statusTag: { borderRadius: radii.sm, paddingVertical: spacing['1'], paddingHorizontal: spacing['2'], alignSelf: 'flex-start' },
    statusText: { fontSize: typography.size.xs, fontFamily: typography.family.semibold },
  });
}
