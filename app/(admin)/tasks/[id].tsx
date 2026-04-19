import { RefreshControl, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, CheckCircle2, Clock, RefreshCw, XCircle } from 'lucide-react-native';
import { formatWeekdays, isRecurring, type AssignmentWithChild } from '@lib/tasks';
import { getAssignmentStatusLabel, getAssignmentStatusTone } from '@lib/status';
import { localizeRpcError } from '@lib/api-error';
import { consumeNavigationFeedback } from '@lib/navigation-feedback';
import { formatDate, toDateString } from '@lib/utils';
import { useTaskAssignments, useTaskDetail } from '@/hooks/queries';
import { useTransientMessage } from '@/hooks/use-transient-message';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineMessage } from '@/components/ui/inline-message';
import { ListFooter } from '@/components/ui/list-footer';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { TaskPointsPill } from '@/components/tasks/task-points-pill';

type DateLine = { label: string; date: string };

const formatValidatedDateLine = (
  label: string,
  assignment: AssignmentWithChild,
): DateLine | null => {
  const date = assignment.validada_em ?? assignment.concluida_em;
  if (!date) return null;
  let formatted = formatDate(date);
  if (assignment.competencia && toDateString(new Date(date)) !== assignment.competencia) {
    formatted += ' · Tarefa de ' + formatDate(assignment.competencia + 'T12:00:00');
  }
  return { label, date: formatted };
};

const getAssignmentDateLine = (assignment: AssignmentWithChild): DateLine | null => {
  switch (assignment.status) {
    case 'pendente': {
      if (!assignment.competencia) {
        return { label: 'Atribuída em ', date: formatDate(assignment.created_at) };
      }
      const today = toDateString(new Date());
      if (assignment.competencia === today) {
        return { label: 'Para ', date: 'hoje' };
      }
      return { label: 'Não realizada em ', date: formatDate(assignment.competencia + 'T12:00:00') };
    }
    case 'aguardando_validacao':
      return assignment.concluida_em
        ? { label: 'Enviada em ', date: formatDate(assignment.concluida_em) }
        : null;
    case 'aprovada':
      return formatValidatedDateLine('Aprovada em ', assignment);
    case 'rejeitada':
      return formatValidatedDateLine('Rejeitada em ', assignment);
  }
};

const getRowStatusLabel = (assignment: AssignmentWithChild): string => {
  if (
    assignment.status === 'pendente' &&
    assignment.competencia !== null &&
    assignment.competencia < toDateString(new Date())
  ) {
    return 'Não executada';
  }
  return getAssignmentStatusLabel(assignment.status);
};

const getRowStatusIcon = (status: AssignmentWithChild['status']) => {
  const map = {
    aprovada: CheckCircle2,
    rejeitada: XCircle,
    pendente: Clock,
    aguardando_validacao: Clock,
  } as const;
  return map[status];
};

type AssignmentRowProps = Readonly<{
  assignment: AssignmentWithChild;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  isLast: boolean;
}>;

const AssignmentRow = ({ assignment, colors, styles, isLast }: AssignmentRowProps) => {
  const dateLine = getAssignmentDateLine(assignment);
  const statusTone = getAssignmentStatusTone(assignment.status, colors);
  const StatusIcon = getRowStatusIcon(assignment.status);

  return (
    <View
      style={[
        styles.atribRow,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border.subtle,
        },
      ]}
    >
      <View style={[styles.atribRowIcon, { backgroundColor: statusTone.background }]}>
        <StatusIcon size={14} color={statusTone.foreground} strokeWidth={2} />
      </View>
      <View style={styles.atribRowInfo}>
        <Text style={[styles.atribRowNome, { color: colors.text.primary }]}>
          {assignment.filhos.nome}
        </Text>
        {assignment.nota_rejeicao ? (
          <Text style={[styles.atribRowNota, { color: colors.text.muted }]} numberOfLines={2}>
            {assignment.nota_rejeicao}
          </Text>
        ) : null}
      </View>
      <View style={styles.atribRowRight}>
        <Text style={[styles.atribRowStatus, { color: statusTone.foreground }]}>
          {getRowStatusLabel(assignment)}
        </Text>
        {dateLine ? (
          <Text style={[styles.atribRowData, { color: colors.text.muted }]}>{dateLine.date}</Text>
        ) : null}
      </View>
    </View>
  );
};

export default function TaskDetailAdminScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data: task, isLoading, error, refetch, isFetching } = useTaskDetail(id);
  const assignmentsQuery = useTaskAssignments(id);

  const navFeedback = consumeNavigationFeedback('admin-task-detail');
  const visibleUpdated = useTransientMessage(navFeedback?.message ?? null);

  const paginated = useMemo(
    () => assignmentsQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [assignmentsQuery.data],
  );

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetch(), assignmentsQuery.refetch()]);
  }, [refetch, assignmentsQuery]);

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.accent.admin} />
      </View>
    );
  }

  if (error || !task) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ScreenHeader title="Detalhes" onBack={() => router.back()} />
        <View style={styles.center}>
          <EmptyState
            error={error?.message ?? 'Tarefa não encontrada.'}
            onRetry={() => refetch()}
          />
        </View>
      </View>
    );
  }

  const isArchived = task.arquivada_em !== null;
  const isInactive = task.ativo === false;

  const renderHistoricoFeedback = () => {
    if (assignmentsQuery.error) {
      return (
        <View style={styles.feedbackWrapper}>
          <InlineMessage
            message={localizeRpcError(assignmentsQuery.error.message)}
            variant="error"
          />
        </View>
      );
    }
    if (paginated.length === 0 && !assignmentsQuery.isLoading) {
      return (
        <Text style={[styles.semHistorico, { color: colors.text.muted }]}>
          Nenhum registro no histórico.
        </Text>
      );
    }
    return null;
  };

  return (
    <SafeScreenFrame bottomInset>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Detalhes" onBack={() => router.back()} backLabel="Tarefas" />

      <FlashList
        data={paginated}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={(isFetching || assignmentsQuery.isFetching) && !isLoading}
            onRefresh={handleRefresh}
            tintColor={colors.accent.admin}
          />
        }
        ListHeaderComponent={
          <>
            {visibleUpdated ? (
              <View style={styles.feedbackWrapper}>
                <InlineMessage message={visibleUpdated} variant="success" />
              </View>
            ) : null}

            {isArchived ? (
              <View style={styles.feedbackWrapper}>
                <InlineMessage message="Esta tarefa está arquivada." variant="warning" />
              </View>
            ) : null}

            {!isArchived && isInactive ? (
              <View style={styles.feedbackWrapper}>
                <InlineMessage message="Esta tarefa está pausada." variant="warning" />
              </View>
            ) : null}

            <View style={[styles.card, { backgroundColor: colors.bg.surface }, shadows.card]}>
              <View style={styles.cardTopo}>
                <Text style={[styles.cardTitulo, { color: colors.text.primary }]}>
                  {task.titulo}
                </Text>
                <TaskPointsPill points={task.pontos} size="md" />
              </View>
              {task.descricao ? (
                <Text style={[styles.descricao, { color: colors.text.secondary }]}>
                  {task.descricao}
                </Text>
              ) : null}
              <View style={styles.metaRow}>
                {isRecurring(task.dias_semana) ? (
                  <RefreshCw size={12} color={colors.text.muted} strokeWidth={2} />
                ) : null}
                <Text style={[styles.meta, { color: colors.text.muted }]}>
                  {formatWeekdays(task.dias_semana)}
                </Text>
              </View>
              {task.exige_evidencia ? (
                <View style={[styles.tagEvidencia, { backgroundColor: colors.bg.muted }]}>
                  <Camera size={12} color={colors.text.muted} strokeWidth={2} />
                  <Text style={[styles.tagEvidenciaTexto, { color: colors.text.muted }]}>
                    Exige foto
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={[styles.historicoHeader, { borderBottomColor: colors.border.subtle }]}>
              <Text style={[styles.secaoTitulo, { color: colors.text.primary }]}>Histórico</Text>
            </View>

            {renderHistoricoFeedback()}
          </>
        }
        renderItem={({ item, index }) => (
          <AssignmentRow
            assignment={item}
            colors={colors}
            styles={styles}
            isLast={index === paginated.length - 1}
          />
        )}
        onEndReached={() => {
          if (assignmentsQuery.hasNextPage && !assignmentsQuery.isFetchingNextPage) {
            assignmentsQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={<ListFooter loading={assignmentsQuery.isFetchingNextPage} />}
      />
    </SafeScreenFrame>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['6'] },
    container: { flex: 1 },
    scrollContent: { padding: spacing['4'], paddingBottom: spacing['12'] },
    feedbackWrapper: { marginBottom: spacing['4'] },
    atribRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing['3'],
      paddingHorizontal: spacing['3'],
      gap: spacing['2'],
      backgroundColor: colors.bg.surface,
    },
    atribRowIcon: {
      width: 30,
      height: 30,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    atribRowInfo: { flex: 1 },
    atribRowNome: { fontSize: typography.size.sm, fontFamily: typography.family.semibold },
    atribRowNota: { fontSize: typography.size.xs, marginTop: spacing['0.5'] },
    atribRowRight: { alignItems: 'flex-end' },
    atribRowStatus: { fontSize: typography.size.xs, fontFamily: typography.family.semibold },
    atribRowData: { fontSize: typography.size.xs, marginTop: spacing['0.5'] },
    card: {
      borderRadius: radii.xl,
      padding: spacing['4'],
      marginBottom: spacing['5'],
    },
    cardTopo: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: spacing['2'],
    },
    cardTitulo: {
      flex: 1,
      fontSize: typography.size.lg,
      fontFamily: typography.family.bold,
      marginRight: spacing['2'],
    },
    descricao: { fontSize: typography.size.sm, marginBottom: spacing['2'], lineHeight: 20 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'] },
    meta: { fontSize: typography.size.xs },
    tagEvidencia: {
      borderRadius: radii.sm,
      paddingVertical: spacing['1'],
      paddingHorizontal: spacing['2'],
      alignSelf: 'flex-start',
      marginTop: spacing['2'],
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1'],
    },
    tagEvidenciaTexto: { fontSize: typography.size.xs, fontFamily: typography.family.semibold },
    secaoTitulo: { fontSize: typography.size.md, fontFamily: typography.family.bold },
    historicoHeader: {
      borderBottomWidth: 1,
      paddingBottom: spacing['3'],
      marginTop: spacing['2'],
      marginBottom: spacing['1'],
    },
    semHistorico: { fontSize: typography.size.sm, fontStyle: 'italic' },
  });
}
