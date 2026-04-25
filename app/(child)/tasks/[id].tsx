import { Alert, StyleSheet, Text, View, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useState, useMemo, useCallback } from 'react';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { RefreshCw, Camera, Clock, Trophy, Maximize2 } from 'lucide-react-native';
import { hapticSuccess } from '@lib/haptics';
import {
  buildValidationLine,
  getAssignmentCancellationState,
  getAssignmentCompletionState,
  getAssignmentPoints,
  getAssignmentRetryState,
  formatWeekdays,
  type ChildAssignment,
} from '@lib/tasks';
import { getAssignmentStatusLabel, getAssignmentStatusTone } from '@lib/status';
import { formatDate } from '@lib/utils';
import {
  useChildAssignment,
  useCancelAssignmentSubmission,
  useCompleteAssignment,
  useDiscardRejection,
  useProfile,
} from '@/hooks/queries';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { TaskPointsPill } from '@/components/tasks/task-points-pill';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { StickyFooterScreen } from '@/components/ui/sticky-footer-screen';
import { Button } from '@/components/ui/button';
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

type FooterStyles = ReturnType<typeof makeStyles>;

type PendingFooterProps = Readonly<{
  requiresEvidence: boolean;
  completing: boolean;
  completionReason: string | null;
  completionError: string | null;
  onComplete: () => void;
}>;

function PendingFooter({
  requiresEvidence,
  completing,
  completionReason,
  completionError,
  onComplete,
}: PendingFooterProps) {
  const label = requiresEvidence ? 'Tirar foto e concluir' : 'Concluir tarefa';
  return (
    <>
      {completionReason ? <InlineMessage message={completionReason} variant="warning" /> : null}
      {!completionReason && completionError ? (
        <InlineMessage message={completionError} variant="error" />
      ) : null}
      {completionReason ? null : (
        <Button
          variant="primary"
          label={label}
          loading={completing}
          loadingLabel="Concluindo…"
          onPress={onComplete}
          accessibilityLabel={label}
        />
      )}
    </>
  );
}

type AwaitingFooterProps = Readonly<{
  canceling: boolean;
  cancelReason: string | null;
  cancelError: string | null;
  onCancelSubmission: () => void;
  colors: ThemeColors;
  styles: FooterStyles;
}>;

function AwaitingFooter({
  canceling,
  cancelReason,
  cancelError,
  onCancelSubmission,
  colors,
  styles,
}: AwaitingFooterProps) {
  return (
    <>
      <View style={styles.awaitingBox}>
        <View style={styles.statusRow}>
          <Clock size={14} color={colors.semantic.info} strokeWidth={2} />
          <Text style={styles.awaitingText}>Aguardando validação do responsável</Text>
        </View>
      </View>
      {cancelReason ? (
        <View style={styles.footerMessage}>
          <InlineMessage message={cancelReason} variant="warning" />
        </View>
      ) : null}
      {!cancelReason && cancelError ? (
        <View style={styles.footerMessage}>
          <InlineMessage message={cancelError} variant="error" />
        </View>
      ) : null}
      {cancelReason ? null : (
        <Button
          variant="danger"
          label="Cancelar envio"
          loading={canceling}
          loadingLabel="Cancelando…"
          onPress={onCancelSubmission}
          accessibilityLabel="Cancelar envio da tarefa"
        />
      )}
    </>
  );
}

type RejectedFooterProps = Readonly<{
  retryReason: string | null;
  attemptsLeft: number;
  canRetry: boolean;
  completing: boolean;
  discarding: boolean;
  completionError: string | null;
  discardError: string | null;
  onRetry: () => void;
  onDiscardRejection: () => void;
}>;

function RejectedFooter({
  retryReason,
  attemptsLeft,
  canRetry,
  completing,
  discarding,
  completionError,
  discardError,
  onRetry,
  onDiscardRejection,
}: RejectedFooterProps) {
  const retryLabel = `Refazer e reenviar (${attemptsLeft} restante${attemptsLeft === 1 ? '' : 's'})`;
  return (
    <>
      {retryReason ? <InlineMessage message={retryReason} variant="warning" /> : null}
      {!retryReason && completionError ? (
        <InlineMessage message={completionError} variant="error" />
      ) : null}
      {discardError ? <InlineMessage message={discardError} variant="error" /> : null}
      {canRetry ? (
        <Button
          variant="primary"
          label={retryLabel}
          loading={completing}
          loadingLabel="Concluindo…"
          onPress={onRetry}
          accessibilityLabel="Refazer e reenviar a tarefa"
        />
      ) : null}
      <Button
        variant="secondary"
        label="Descartar feedback"
        loading={discarding}
        loadingLabel="Descartando…"
        onPress={onDiscardRejection}
        accessibilityLabel="Descartar feedback de rejeição"
      />
    </>
  );
}

type ApprovedFooterProps = Readonly<{
  assignment: ChildAssignment;
  onBack: () => void;
  colors: ThemeColors;
  styles: FooterStyles;
}>;

function ApprovedFooter({ assignment, onBack, colors, styles }: ApprovedFooterProps) {
  return (
    <>
      <View style={styles.approvedBox}>
        <View style={styles.statusRow}>
          <Trophy size={14} color={colors.semantic.success} strokeWidth={2} />
          <Text style={styles.approvedText}>
            Parabéns! {getAssignmentPoints(assignment)} pontos creditados no seu saldo 🎉
          </Text>
        </View>
      </View>
      <Button
        variant="secondary"
        label="Voltar às tarefas"
        onPress={onBack}
        accessibilityLabel="Voltar à lista de tarefas"
      />
    </>
  );
}

type StatusFooterProps = Readonly<{
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
  styles: FooterStyles;
}>;

function StatusFooter(props: StatusFooterProps) {
  const { assignment } = props;
  switch (assignment.status) {
    case 'pendente':
      return (
        <PendingFooter
          requiresEvidence={assignment.tarefas.exige_evidencia}
          completing={props.completing}
          completionReason={props.completionReason}
          completionError={props.completionError}
          onComplete={props.onComplete}
        />
      );
    case 'aguardando_validacao':
      return (
        <AwaitingFooter
          canceling={props.canceling}
          cancelReason={props.cancelReason}
          cancelError={props.cancelError}
          onCancelSubmission={props.onCancelSubmission}
          colors={props.colors}
          styles={props.styles}
        />
      );
    case 'rejeitada':
      return (
        <RejectedFooter
          retryReason={props.retryReason}
          attemptsLeft={props.attemptsLeft}
          canRetry={props.canRetry}
          completing={props.completing}
          discarding={props.discarding}
          completionError={props.completionError}
          discardError={props.discardError}
          onRetry={props.onRetry}
          onDiscardRejection={props.onDiscardRejection}
        />
      );
    case 'aprovada':
      return (
        <ApprovedFooter
          assignment={assignment}
          onBack={props.onBack}
          colors={props.colors}
          styles={props.styles}
        />
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
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data: assignment, isLoading, error, refetch } = useChildAssignment(id);
  const { data: profile } = useProfile();
  const completeMutation = useCompleteAssignment();
  const cancelMutation = useCancelAssignmentSubmission();
  const discardMutation = useDiscardRejection();

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

    const imageUri = latest.tarefas.exige_evidencia ? await pickEvidenceImage() : null;
    if (latest.tarefas.exige_evidencia && !imageUri) return;

    await completeMutation.mutateAsync({
      assignmentId: latest.id,
      imageUri,
      opts: {
        familiaId: latest.tarefas.familia_id,
        childName: profile?.nome ?? '',
        taskTitle: latest.tarefas.titulo,
        taskId: latest.tarefas.id,
        childUserId: profile?.id,
      },
    });
    hapticSuccess();
    setFeedbackMessage('Tarefa enviada com sucesso! 🚀');
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
  const validationLine = buildValidationLine(assignment);
  const inactiveTaskMessage = computeInactiveTaskMessage(assignment);
  const footer = (
    <StatusFooter
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
    />
  );

  return (
    <>
      <StickyFooterScreen
        title="Detalhe"
        onBack={() => router.back()}
        backLabel="Tarefas"
        role="filho"
        keyboardAvoiding={assignment.status === 'pendente'}
        contentPadding={spacing['4']}
        footer={footer}
      >
        <StatusBar style={colors.statusBar} />
        <View style={[styles.statusBadge, { backgroundColor: statusTone.background }]}>
          <Text style={[styles.statusBadgeText, { color: statusTone.text }]}>
            {getAssignmentStatusLabel(assignment.status)}
          </Text>
        </View>

        {validationLine ? <Text style={styles.dateLine}>{validationLine}</Text> : null}

        {assignment.status === 'aguardando_validacao' && assignment.concluida_em ? (
          <Text style={styles.dateLine}>Enviada em {formatDate(assignment.concluida_em)}</Text>
        ) : null}

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

        <View style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.cardTitle}>{task.titulo}</Text>
            <TaskPointsPill points={getAssignmentPoints(assignment)} size="md" />
          </View>
          {task.descricao ? <Text style={styles.description}>{task.descricao}</Text> : null}
          <View style={styles.metaRow}>
            <RefreshCw size={12} color={colors.text.muted} strokeWidth={2} />
            <Text style={styles.meta}>{formatWeekdays(task.dias_semana)}</Text>
          </View>
          {task.exige_evidencia ? (
            <View style={styles.evidenceTag}>
              <View style={styles.evidenceTagRow}>
                <Camera size={12} color={colors.text.muted} strokeWidth={2} />
                <Text style={styles.evidenceTagText}>Enviar foto como prova</Text>
              </View>
            </View>
          ) : null}
        </View>

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
              Quase lá! Converse com o responsável e tente de novo 💪
            </Text>
          </View>
        ) : null}
      </StickyFooterScreen>

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
    statusBadge: {
      borderRadius: radii.lg,
      paddingVertical: spacing['2'],
      paddingHorizontal: spacing['4'],
      alignSelf: 'center',
      marginBottom: spacing['4'],
    },
    statusBadgeText: { fontSize: typography.size.sm, fontFamily: typography.family.bold },
    dateLine: {
      textAlign: 'center',
      fontSize: typography.size.xs,
      fontFamily: typography.family.medium,
      color: colors.text.muted,
      marginBottom: spacing['4'],
    },
    feedbackWrapper: { marginBottom: spacing['4'] },
    card: {
      backgroundColor: colors.bg.surface,
      borderRadius: radii.xl,
      padding: spacing['4'],
      marginBottom: spacing['4'],
      ...shadows.card,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: spacing['2'],
    },
    cardTitle: {
      flex: 1,
      fontSize: typography.size.lg,
      fontFamily: typography.family.bold,
      color: colors.text.primary,
      marginRight: spacing['2'],
    },
    description: {
      fontSize: typography.size.sm,
      color: colors.text.secondary,
      marginBottom: spacing['2'],
      lineHeight: 20,
    },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'] },
    meta: { fontSize: typography.size.xs, color: colors.text.muted },
    evidenceTag: {
      backgroundColor: colors.bg.muted,
      borderRadius: radii.sm,
      paddingVertical: spacing['1'],
      paddingHorizontal: spacing['2'],
      alignSelf: 'flex-start',
      marginTop: spacing['2'],
    },
    evidenceTagRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'] },
    evidenceTagText: {
      fontSize: typography.size.xs,
      color: colors.text.muted,
      fontFamily: typography.family.semibold,
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
    footerMessage: { marginTop: spacing['2'] },
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
