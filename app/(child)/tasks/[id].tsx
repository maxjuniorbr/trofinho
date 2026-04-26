import { Alert, ScrollView, StyleSheet, Text, View, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useState, useMemo, useCallback } from 'react';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Clock, Trophy, Maximize2, Star, Calendar, Send, XCircle, RotateCcw, Trash2, CheckCircle2 } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { hapticSuccess } from '@lib/haptics';
import {
  getAssignmentCancellationState,
  getAssignmentCompletionState,
  getAssignmentPoints,
  getAssignmentRetryState,
  formatWeekdays,
  type ChildAssignment,
} from '@lib/tasks';
import { getAssignmentStatusLabel, getAssignmentStatusTone } from '@lib/status';
import {
  useChildAssignment,
  useChildAssignments,
  useCancelAssignmentSubmission,
  useCompleteAssignment,
  useDiscardRejection,
  useProfile,
} from '@/hooks/queries';
import { useTheme } from '@/context/theme-context';
import { useImpersonation } from '@/context/impersonation-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { TaskPointsPill } from '@/components/tasks/task-points-pill';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { InlineMessage } from '@/components/ui/inline-message';
import { FullscreenImageViewer } from '@/components/ui/fullscreen-image-viewer';
import { useTransientMessage } from '@/hooks/use-transient-message';

type EvidenceSectionProps = Readonly<{
  evidenceUrl: string | null | undefined;
  imgLoading: boolean;
  imgError: boolean;
  onImgLoadStart: () => void;
  onImgLoadEnd: () => void;
  onImgError: () => void;
  onRetryImage: () => void;
  onImagePress: (url: string) => void;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}>;

function EvidenceSection({
  evidenceUrl,
  imgLoading,
  imgError,
  onImgLoadStart,
  onImgLoadEnd,
  onImgError,
  onRetryImage,
  onImagePress,
  colors,
  styles,
}: EvidenceSectionProps) {
  if (!evidenceUrl) return null;

  if (imgError) {
    return (
      <View style={styles.evidenceBox}>
        <Text style={styles.evidenceLabel}>Foto enviada:</Text>
        <View
          style={[
            styles.evidenceImgWrapper,
            styles.evidenceFallback,
            { backgroundColor: colors.bg.muted },
          ]}
        >
          <Text style={[styles.evidenceFallbackText, { color: colors.text.muted }]}>
            Não foi possível carregar a imagem
          </Text>
          <Pressable
            style={[styles.retryImageBtn, { borderColor: colors.border.default }]}
            onPress={onRetryImage}
            accessibilityRole="button"
            accessibilityLabel="Tentar carregar imagem novamente"
          >
            <Text style={[styles.retryImageText, { color: colors.accent.filho }]}>
              Tentar de novo
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.evidenceBox}>
      <Text style={styles.evidenceLabel}>Foto enviada:</Text>
      <Pressable
        style={styles.evidenceImgWrapper}
        onPress={() => onImagePress(evidenceUrl)}
        accessibilityRole="button"
        accessibilityLabel="Ver foto em tela cheia"
      >
        <Image
          source={evidenceUrl}
          style={styles.evidenceImg}
          contentFit="cover"
          transition={200}
          onLoadStart={onImgLoadStart}
          onLoad={onImgLoadEnd}
          onError={onImgError}
        />
        {imgLoading ? (
          <View style={styles.evidenceLoading}>
            <ActivityIndicator size="small" color={colors.accent.filho} />
          </View>
        ) : (
          <View style={styles.expandIcon}>
            <Maximize2 size={16} color={colors.text.inverse} strokeWidth={2.5} />
          </View>
        )}
      </Pressable>
    </View>
  );
}

/* ─── ActionButton — same pattern as admin task detail ─── */

type ActionButtonProps = Readonly<{
  icon: LucideIcon;
  title: string;
  description: string;
  iconColor: string;
  borderColor?: string;
  bgColor?: string;
  titleColor?: string;
  loading?: boolean;
  disabled?: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  onPress: () => void;
}>;

function ActionButton({
  icon: Icon,
  title,
  description,
  iconColor,
  borderColor,
  bgColor,
  titleColor,
  loading,
  disabled,
  colors,
  styles,
  onPress,
}: ActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.actionBtn,
        {
          backgroundColor: bgColor ?? colors.bg.surface,
          borderColor: borderColor ?? colors.border.subtle,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
    >
      {loading ? (
        <ActivityIndicator size={20} color={iconColor} />
      ) : (
        <Icon size={20} color={iconColor} strokeWidth={2} />
      )}
      <View style={styles.actionBtnText}>
        <Text style={[styles.actionBtnTitle, { color: titleColor ?? colors.text.primary }]}>
          {title}
        </Text>
        <Text style={[styles.actionBtnDesc, { color: colors.text.muted }]}>{description}</Text>
      </View>
    </Pressable>
  );
}

/* ─── Status-based action sections ─── */

type StatusActionsProps = Readonly<{
  assignment: ChildAssignment;
  completing: boolean;
  canceling: boolean;
  discarding: boolean;
  completionReason: string | null;
  completionError: string | null;
  cancelError: string | null;
  cancelReason: string | null;
  retryReason: string | null;
  attemptsLeft: number;
  canRetry: boolean;
  discardError: string | null;
  onComplete: () => void;
  onRetry: () => void;
  onDiscardRejection: () => void;
  onCancelSubmission: () => void;
  onBack: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  disabled?: boolean;
}>;

function StatusActions(props: StatusActionsProps) {
  const { assignment, colors, styles, disabled } = props;

  switch (assignment.status) {
    case 'pendente': {
      const requiresEvidence = assignment.exige_evidencia_snapshot;
      return (
        <>
          {props.completionReason ? <InlineMessage message={props.completionReason} variant="warning" /> : null}
          {!props.completionReason && props.completionError ? <InlineMessage message={props.completionError} variant="error" /> : null}
          {props.completionReason ? null : (
            <ActionButton
              icon={requiresEvidence ? Camera : Send}
              title={requiresEvidence ? 'Tirar foto e concluir' : 'Concluir tarefa'}
              description={requiresEvidence ? 'Abrir câmera e enviar comprovação' : 'Marcar como feita e enviar para aprovação'}
              iconColor={colors.semantic.success}
              borderColor={colors.semantic.success + '66'}
              bgColor={colors.semantic.successBg}
              loading={props.completing}
              disabled={disabled}
              colors={colors}
              styles={styles}
              onPress={props.onComplete}
            />
          )}
        </>
      );
    }
    case 'aguardando_validacao':
      return (
        <>
          <View style={styles.awaitingBox}>
            <View style={styles.statusRow}>
              <Clock size={14} color={colors.semantic.info} strokeWidth={2} />
              <Text style={styles.awaitingText}>Aguardando validação do responsável</Text>
            </View>
          </View>
          {props.cancelReason ? <InlineMessage message={props.cancelReason} variant="warning" /> : null}
          {!props.cancelReason && props.cancelError ? <InlineMessage message={props.cancelError} variant="error" /> : null}
          {props.cancelReason ? null : (
            <ActionButton
              icon={XCircle}
              title="Cancelar envio"
              description="Volta para 'Para fazer' e você pode enviar de novo"
              iconColor={colors.semantic.error}
              borderColor={colors.semantic.error + '66'}
              bgColor={colors.semantic.errorBg}
              titleColor={colors.semantic.error}
              loading={props.canceling}
              disabled={disabled}
              colors={colors}
              styles={styles}
              onPress={props.onCancelSubmission}
            />
          )}
        </>
      );
    case 'rejeitada': {
      const retryLabel = `Refazer e reenviar (${props.attemptsLeft} restante${props.attemptsLeft === 1 ? '' : 's'})`;
      return (
        <>
          {props.retryReason ? <InlineMessage message={props.retryReason} variant="warning" /> : null}
          {!props.retryReason && props.completionError ? <InlineMessage message={props.completionError} variant="error" /> : null}
          {props.discardError ? <InlineMessage message={props.discardError} variant="error" /> : null}
          {props.canRetry ? (
            <ActionButton
              icon={RotateCcw}
              title={retryLabel}
              description="Refazer a tarefa e enviar novamente"
              iconColor={colors.semantic.success}
              borderColor={colors.semantic.success + '66'}
              bgColor={colors.semantic.successBg}
              loading={props.completing}
              disabled={disabled}
              colors={colors}
              styles={styles}
              onPress={props.onRetry}
            />
          ) : null}
          <ActionButton
            icon={Trash2}
            title="Descartar feedback"
            description="Remove a nota de rejeição"
            iconColor={colors.text.muted}
            loading={props.discarding}
            disabled={disabled}
            colors={colors}
            styles={styles}
            onPress={props.onDiscardRejection}
          />
        </>
      );
    }
    case 'aprovada':
      return (
        <>
          <View style={styles.approvedBox}>
            <View style={styles.statusRow}>
              <Trophy size={14} color={colors.semantic.success} strokeWidth={2} />
              <Text style={styles.approvedText}>
                Parabéns! {getAssignmentPoints(assignment)} pontos creditados no seu saldo
              </Text>
            </View>
          </View>
          <ActionButton
            icon={CheckCircle2}
            title="Voltar às tarefas"
            description="Ver lista de tarefas"
            iconColor={colors.accent.filho}
            colors={colors}
            styles={styles}
            onPress={props.onBack}
          />
        </>
      );
    default:
      return null;
  }
}

async function pickEvidenceImage(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permissão da câmera negada. Habilite nas configurações do dispositivo.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    allowsEditing: true,
    aspect: [4, 3],
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  return result.assets[0].uri;
}

function computeInactiveTaskMessage(assignment: ChildAssignment): string | null {
  if (assignment.tarefas.ativo !== false || assignment.status === 'pendente') return null;
  return assignment.status === 'aguardando_validacao'
    ? 'Esta tarefa foi desativada pelo responsável. O envio atual segue apenas para acompanhamento e não pode mais ser alterado.'
    : 'Esta tarefa foi desativada pelo responsável. Volte para a lista para acompanhar as demais tarefas.';
}

export default function ChildTaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { impersonating } = useImpersonation();
  const isReadOnly = impersonating !== null;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data: assignment, isLoading, error, refetch } = useChildAssignment(id);
  const { data: profile } = useProfile();
  const completeMutation = useCompleteAssignment();
  const cancelMutation = useCancelAssignmentSubmission();
  const discardMutation = useDiscardRejection();

  // Stats: all assignments for this task (used for approval count / points earned)
  const allAssignmentsQuery = useChildAssignments();
  const taskAssignments = useMemo(() => {
    if (!assignment) return [];
    const all = allAssignmentsQuery.data?.pages.flatMap((p) => p.data) ?? [];
    return all.filter((a) => a.tarefa_id === assignment.tarefa_id);
  }, [allAssignmentsQuery.data, assignment]);
  const approvedCount = useMemo(
    () => taskAssignments.filter((a) => a.status === 'aprovada').length,
    [taskAssignments],
  );
  const totalPointsEarned = useMemo(
    () => taskAssignments.filter((a) => a.status === 'aprovada').reduce((sum, a) => sum + getAssignmentPoints(a), 0),
    [taskAssignments],
  );

  const [completionError, setCompletionError] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [discardError, setDiscardError] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(true);
  const [imgError, setImgError] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackKey, setFeedbackKey] = useState(0);
  const visibleFeedback = useTransientMessage(feedbackMessage, { resetKey: feedbackKey });
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setCompletionError(null);
      setCancelError(null);
      setDiscardError(null);
      refetch();
    }, [refetch]),
  );

  const runCompletion = async (latest: ChildAssignment) => {
    const completionState = getAssignmentCompletionState(latest, latest.tarefas);
    if (!completionState.canComplete) {
      setCompletionError(completionState.reason ?? null);
      return;
    }

    const imageUri = latest.exige_evidencia_snapshot ? await pickEvidenceImage() : null;
    if (latest.exige_evidencia_snapshot && !imageUri) return;

    await completeMutation.mutateAsync({
      assignmentId: latest.id,
      imageUri,
      opts: {
        familiaId: latest.tarefas.familia_id,
        childName: profile?.nome ?? '',
        taskTitle: latest.titulo_snapshot,
        taskId: latest.tarefas.id,
        childUserId: profile?.id,
      },
    });
    hapticSuccess();
    setFeedbackMessage('Tarefa enviada com sucesso!');
    setFeedbackKey((k) => k + 1);
  };

  const handleComplete = async () => {
    if (!assignment) return;
    setCompletionError(null);

    try {
      const latestResult = await refetch();
      if (latestResult.error) {
        setCompletionError(latestResult.error.message);
        return;
      }
      await runCompletion(latestResult.data ?? assignment);
    } catch (error_) {
      setCompletionError(
        error_ instanceof Error ? error_.message : 'Não foi possível concluir a tarefa agora.',
      );
    }
  };

  const handleDiscardRejection = () => {
    if (!assignment) return;
    setDiscardError(null);
    discardMutation.mutate(assignment.id, {
      onSuccess: () => {
        setFeedbackMessage('Feedback descartado.');
        setFeedbackKey((k) => k + 1);
      },
      onError: (err) => setDiscardError(err.message),
    });
  };

  const handleCancelSubmission = async () => {
    if (!assignment) return;
    setCancelError(null);

    const latestResult = await refetch();
    if (latestResult.error) {
      setCancelError(latestResult.error.message);
      return;
    }

    const latestAssignment = latestResult.data ?? assignment;
    const cancellationState = getAssignmentCancellationState(
      latestAssignment,
      latestAssignment.tarefas,
    );
    if (!cancellationState.canCancel) {
      setCancelError(cancellationState.reason ?? null);
      return;
    }

    Alert.alert(
      'Cancelar envio?',
      'A tarefa vai voltar para "Para fazer" e você poderá enviar de novo.',
      [
        { text: 'Manter', style: 'cancel' },
        {
          text: 'Cancelar envio',
          style: 'destructive',
          onPress: () => executeCancellation(latestAssignment.id),
        },
      ],
    );
  };

  const executeCancellation = (assignmentId: string) => {
    setCancelError(null);
    cancelMutation.mutate(
      { assignmentId },
      {
        onSuccess: () => {
          setCompletionError(null);
          setCancelError(null);
          setFeedbackMessage('Envio cancelado com sucesso.');
          setFeedbackKey((currentKey) => currentKey + 1);
        },
        onError: (mutationError) => {
          setCancelError(mutationError.message);
        },
      },
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.accent.filho} />
      </View>
    );
  }

  if (error || !assignment) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ScreenHeader
          title="Detalhe"
          onBack={() => router.back()}
          backLabel="Tarefas"
          role="filho"
        />
        <View style={styles.center}>
          <EmptyState
            error={error?.message ?? 'Tarefa não encontrada.'}
            onRetry={() => refetch()}
          />
        </View>
      </View>
    );
  }

  const task = assignment.tarefas;
  const statusTone = getAssignmentStatusTone(assignment.status, colors);
  const completionState = getAssignmentCompletionState(assignment, task);
  const cancellationState = getAssignmentCancellationState(assignment, task);
  const retryState = getAssignmentRetryState(assignment);
  const inactiveTaskMessage = computeInactiveTaskMessage(assignment);

  return (
    <>
      <SafeScreenFrame bottomInset>
        <StatusBar style={colors.statusBar} />
        <ScreenHeader
          title="Detalhe"
          onBack={() => router.back()}
          backLabel="Tarefas"
          role="filho"
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => refetch()}
              tintColor={colors.accent.filho}
            />
          }
        >
          {visibleFeedback ? (
            <View style={styles.feedbackWrapper}>
              <InlineMessage message={visibleFeedback} variant="success" />
            </View>
          ) : null}

          {inactiveTaskMessage ? (
            <View style={styles.feedbackWrapper}>
              <InlineMessage message={inactiveTaskMessage} variant="warning" />
            </View>
          ) : null}

          {/* ─── Main card ─── */}
          <View style={[styles.card, shadows.card]}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{assignment.titulo_snapshot}</Text>
              <View style={[styles.pointsBadge, { backgroundColor: colors.accent.filhoBg }]}>
                <Star size={14} color={colors.accent.filho} strokeWidth={2} />
                <TaskPointsPill points={getAssignmentPoints(assignment)} size="md" />
              </View>
            </View>

            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: statusTone.background }]}>
                <Text style={[styles.badgeText, { color: statusTone.foreground }]}>
                  {getAssignmentStatusLabel(assignment.status)}
                </Text>
              </View>
              {assignment.exige_evidencia_snapshot ? (
                <View style={[styles.badge, { backgroundColor: colors.bg.muted }]}>
                  <Camera size={10} color={colors.text.muted} strokeWidth={2.5} />
                  <Text style={[styles.badgeText, { color: colors.text.muted }]}>Exige foto</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.recurrenceRow}>
              <Calendar size={14} color={colors.text.muted} strokeWidth={2} />
              <Text style={[styles.recurrenceText, { color: colors.text.muted }]}>
                {formatWeekdays(task.dias_semana)}
              </Text>
            </View>

            <View style={[styles.descSection, { borderTopColor: colors.border.subtle }]}>
              <Text style={[styles.sectionLabel, { color: colors.text.muted }]}>Descrição</Text>
              {assignment.descricao_snapshot ? (
                <Text style={[styles.descText, { color: colors.text.primary }]}>
                  {assignment.descricao_snapshot}
                </Text>
              ) : (
                <Text style={[styles.descEmpty, { color: colors.text.muted }]}>Sem descrição</Text>
              )}
            </View>
          </View>

          {/* ─── Quick stats (same as admin) ─── */}
          {approvedCount > 0 ? (
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}>
                <Text style={[styles.statLabel, { color: colors.text.muted }]}>Aprovações</Text>
                <Text style={[styles.statValue, { color: colors.semantic.success }]}>{approvedCount}</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}>
                <Text style={[styles.statLabel, { color: colors.text.muted }]}>Pontos ganhos</Text>
                <Text style={[styles.statValue, { color: colors.text.primary }]}>{totalPointsEarned}</Text>
              </View>
            </View>
          ) : null}

          <EvidenceSection
            evidenceUrl={assignment.evidencia_url}
            imgLoading={imgLoading}
            imgError={imgError}
            onImgLoadStart={() => setImgLoading(true)}
            onImgLoadEnd={() => setImgLoading(false)}
            onImgError={() => {
              setImgLoading(false);
              setImgError(true);
            }}
            onRetryImage={() => {
              setImgError(false);
              setImgLoading(true);
            }}
            onImagePress={(url) => setFullscreenImageUrl(url)}
            colors={colors}
            styles={styles}
          />

          {assignment.nota_rejeicao ? (
            <View style={styles.rejectionNoteBox}>
              <Text style={styles.rejectionNoteLabel}>No que ajustar:</Text>
              <Text style={styles.rejectionNoteText}>{assignment.nota_rejeicao}</Text>
              <Text style={styles.rejectionNoteHint}>
                Quase lá! Converse com o responsável e tente de novo.
              </Text>
            </View>
          ) : null}

          {/* ─── Action buttons (bottom, same position as admin Pausar/Arquivar) ─── */}
          <View style={styles.actionsSection}>
            <StatusActions
              assignment={assignment}
              completing={completeMutation.isPending}
              canceling={cancelMutation.isPending}
              discarding={discardMutation.isPending}
              completionReason={completionState.reason}
              completionError={completionError}
              cancelError={cancelError}
              cancelReason={cancellationState.reason}
              retryReason={retryState.reason}
              attemptsLeft={retryState.attemptsLeft}
              canRetry={retryState.canRetry && task.ativo !== false}
              discardError={discardError}
              onComplete={handleComplete}
              onRetry={handleComplete}
              onDiscardRejection={handleDiscardRejection}
              onCancelSubmission={handleCancelSubmission}
              onBack={() => router.back()}
              colors={colors}
              styles={styles}
              disabled={isReadOnly}
            />
          </View>
        </ScrollView>
      </SafeScreenFrame>

      {fullscreenImageUrl ? (
        <FullscreenImageViewer
          visible
          imageUrl={fullscreenImageUrl}
          onClose={() => setFullscreenImageUrl(null)}
        />
      ) : null}
    </>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['6'] },
    container: { flex: 1 },
    scrollContent: { padding: spacing['4'], paddingBottom: spacing['12'] },
    feedbackWrapper: { marginBottom: spacing['4'] },
    actionsSection: { gap: spacing['2'], marginBottom: spacing['4'], marginTop: spacing['2'] },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['3'],
      padding: spacing['3'],
      borderRadius: radii.lg,
      borderWidth: 1,
    },
    actionBtnText: { flex: 1 },
    actionBtnTitle: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.bold,
    },
    actionBtnDesc: {
      fontSize: typography.size.xxs,
      color: colors.text.muted,
    },
    // ── Quick stats (same as admin) ──
    statsGrid: {
      flexDirection: 'row',
      gap: spacing['3'],
      marginBottom: spacing['4'],
    },
    statCard: {
      flex: 1,
      borderRadius: radii.lg,
      padding: spacing['3'],
      borderWidth: StyleSheet.hairlineWidth,
    },
    statLabel: {
      fontSize: typography.size.xxs,
      fontFamily: typography.family.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    statValue: {
      fontSize: typography.size.xl,
      fontFamily: typography.family.extrabold,
      marginTop: spacing['0.5'],
    },
    card: {
      backgroundColor: colors.bg.surface,
      borderRadius: radii.xl,
      padding: spacing['5'],
      marginBottom: spacing['4'],
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing['3'],
      marginBottom: spacing['3'],
    },
    cardTitle: {
      flex: 1,
      fontSize: typography.size.lg,
      fontFamily: typography.family.extrabold,
      color: colors.text.primary,
      lineHeight: typography.lineHeight.lg,
    },
    pointsBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1'],
      borderRadius: radii.md,
      paddingHorizontal: spacing['2'],
      paddingVertical: spacing['1'],
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1.5'],
      flexWrap: 'wrap',
      marginBottom: spacing['3'],
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1'],
      borderRadius: radii.sm,
      paddingHorizontal: spacing['2'],
      paddingVertical: spacing['1'],
    },
    badgeText: {
      fontSize: typography.size.xxs,
      fontFamily: typography.family.extrabold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    recurrenceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1.5'],
    },
    recurrenceText: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.semibold,
    },
    descSection: {
      marginTop: spacing['3'],
      paddingTop: spacing['3'],
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    sectionLabel: {
      fontSize: typography.size.xxs,
      fontFamily: typography.family.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing['1'],
    },
    descText: {
      fontSize: typography.size.sm,
      lineHeight: 20,
    },
    descEmpty: {
      fontSize: typography.size.sm,
      fontStyle: 'italic',
    },
    evidenceBox: { marginBottom: spacing['4'] },
    evidenceLabel: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.semibold,
      color: colors.text.secondary,
      marginBottom: spacing['2'],
    },
    evidenceImgWrapper: { width: '100%', height: 220, borderRadius: radii.xl, overflow: 'hidden' },
    evidenceImg: { width: '100%', height: 220 },
    evidenceLoading: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bg.muted,
    },
    expandIcon: {
      position: 'absolute',
      bottom: spacing['2'],
      right: spacing['2'],
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: radii.sm,
      padding: spacing['1'],
    },
    evidenceFallback: { alignItems: 'center', justifyContent: 'center' },
    evidenceFallbackText: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.medium,
      textAlign: 'center',
    },
    retryImageBtn: {
      marginTop: spacing['2'],
      borderWidth: 1,
      borderRadius: radii.md,
      paddingVertical: spacing['2'],
      paddingHorizontal: spacing['3'],
    },
    retryImageText: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.semibold,
    },
    rejectionNoteBox: {
      backgroundColor: colors.semantic.errorBg,
      borderRadius: radii.xl,
      padding: spacing['3'],
      marginBottom: spacing['4'],
    },
    rejectionNoteLabel: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.bold,
      color: colors.semantic.error,
      marginBottom: spacing['1'],
    },
    rejectionNoteText: {
      fontSize: typography.size.sm,
      color: colors.text.primary,
      marginBottom: spacing['2'],
    },
    rejectionNoteHint: {
      fontSize: typography.size.xs,
      color: colors.text.muted,
      fontStyle: 'italic',
    },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1.5'] },
    awaitingBox: {
      backgroundColor: colors.semantic.infoBg,
      borderRadius: radii.xl,
      padding: spacing['3'],
      alignItems: 'center',
      marginTop: spacing['2'],
    },
    awaitingText: {
      fontSize: typography.size.sm,
      color: colors.semantic.infoText,
      fontFamily: typography.family.semibold,
    },
    approvedBox: {
      backgroundColor: colors.semantic.successBg,
      borderRadius: radii.xl,
      padding: spacing['3'],
      alignItems: 'center',
      marginTop: spacing['2'],
    },
    approvedText: {
      fontSize: typography.size.sm,
      color: colors.semantic.success,
      fontFamily: typography.family.semibold,
      textAlign: 'center',
    },
  });
}
