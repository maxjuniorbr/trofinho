import {
  Alert,
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useState, useMemo, useCallback } from 'react';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  RefreshCw,
  Camera,
  Clock,
  Trophy,
  CheckCircle2,
} from 'lucide-react-native';
import {
  getAssignmentCancellationState,
  getAssignmentCompletionState,
  getAssignmentPoints,
  type ChildAssignment,
} from '@lib/tasks';
import { getAssignmentStatusColor, getAssignmentStatusLabel } from '@lib/status';
import { useChildAssignment, useCancelAssignmentSubmission, useCompleteAssignment, useProfile } from '@/hooks/queries';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
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
  onImagePress: (url: string) => void;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}>;

function EvidenceSection({ evidenceUrl, imgLoading, imgError, onImgLoadStart, onImgLoadEnd, onImgError, onImagePress, colors, styles }: EvidenceSectionProps) {
  if (!evidenceUrl) return null;

  if (imgError) {
    return (
      <View style={styles.evidenceBox}>
        <Text style={styles.evidenceLabel}>Foto enviada:</Text>
        <View style={[styles.evidenceImgWrapper, styles.evidenceFallback, { backgroundColor: colors.bg.muted }]}>
          <Text style={[styles.evidenceFallbackText, { color: colors.text.muted }]}>Não foi possível carregar a imagem</Text>
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
        ) : null}
      </Pressable>
    </View>
  );
}

type StatusFooterProps = Readonly<{
  assignment: ChildAssignment;
  completing: boolean;
  canceling: boolean;
  completionReason: string | null;
  completionError: string | null;
  cancelError: string | null;
  cancelReason: string | null;
  onComplete: () => void;
  onCancelSubmission: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}>;

type CompleteButtonContentProps = Readonly<{
  requiresEvidence: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}>;

function CompleteButtonContent({ requiresEvidence, colors, styles }: CompleteButtonContentProps) {
  const Icon = requiresEvidence ? Camera : CheckCircle2;
  const label = requiresEvidence ? 'Tirar foto e concluir' : 'Concluir tarefa';

  return (
    <View style={styles.completeBtnInner}>
      <Icon size={16} color={colors.text.inverse} strokeWidth={2} />
      <Text style={[styles.completeBtnText, { color: colors.text.inverse }]}>{label}</Text>
    </View>
  );
}

function StatusFooter({
  assignment,
  completing,
  canceling,
  completionReason,
  completionError,
  cancelError,
  cancelReason,
  onComplete,
  onCancelSubmission,
  colors,
  styles,
}: StatusFooterProps) {
  if (assignment.status === 'pendente') {
    const requiresEvidence = assignment.tarefas.exige_evidencia;
    return (
      <>
        {completionReason && <InlineMessage message={completionReason} variant="warning" />}
        {!completionReason && completionError && <InlineMessage message={completionError} variant="error" />}
        {!completionReason && (
          <Pressable
            style={[styles.completeBtn, completing && styles.disabledBtn]}
            onPress={onComplete}
            disabled={completing}
            accessibilityRole="button"
            accessibilityLabel={requiresEvidence ? 'Tirar foto e concluir tarefa' : 'Concluir tarefa'}
          >
            {completing
              ? <ActivityIndicator color={colors.text.inverse} />
              : <CompleteButtonContent requiresEvidence={requiresEvidence} colors={colors} styles={styles} />}
          </Pressable>
        )}
      </>
    );
  }

  if (assignment.status === 'aguardando_validacao') {
    return (
      <>
        <View style={styles.awaitingBox}>
          <View style={styles.statusRow}>
            <Clock size={14} color={colors.accent.filho} strokeWidth={2} />
            <Text style={styles.awaitingText}>Aguardando validação do responsável</Text>
          </View>
        </View>
        {cancelReason && (
          <View style={styles.footerMessage}>
            <InlineMessage message={cancelReason} variant="warning" />
          </View>
        )}
        {!cancelReason && cancelError && (
          <View style={styles.footerMessage}>
            <InlineMessage message={cancelError} variant="error" />
          </View>
        )}
        {!cancelReason && (
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

  if (assignment.status === 'aprovada') {
    return (
      <View style={styles.approvedBox}>
        <View style={styles.statusRow}>
          <Trophy size={14} color={colors.semantic.success} strokeWidth={2} />
          <Text style={styles.approvedText}>Parabéns! {getAssignmentPoints(assignment)} pontos creditados no seu saldo.</Text>
        </View>
      </View>
    );
  }

  return null;
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

export default function ChildTaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data: assignment, isLoading, error, refetch } = useChildAssignment(id);
  const { data: profile } = useProfile();
  const completeMutation = useCompleteAssignment();
  const cancelMutation = useCancelAssignmentSubmission();

  const [completionError, setCompletionError] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(true);
  const [imgError, setImgError] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackKey, setFeedbackKey] = useState(0);
  const visibleFeedback = useTransientMessage(feedbackMessage, { resetKey: feedbackKey });
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    setCompletionError(null);
    setCancelError(null);
    refetch();
  }, [refetch]));

  const handleComplete = async () => {
    if (!assignment) return;
    setCompletionError(null);

    try {
      const latestResult = await refetch();
      if (latestResult.error) {
        setCompletionError(latestResult.error.message);
        return;
      }

      const latestAssignment = latestResult.data ?? assignment;
      const completionState = getAssignmentCompletionState(latestAssignment, latestAssignment.tarefas);
      if (!completionState.canComplete) {
        if (completionState.reason) {
          setCompletionError(completionState.reason);
        }
        return;
      }

      const imageUri = latestAssignment.tarefas.exige_evidencia
        ? await pickEvidenceImage()
        : null;

      if (latestAssignment.tarefas.exige_evidencia && !imageUri) {
        return;
      }

      await completeMutation.mutateAsync({
        assignmentId: latestAssignment.id,
        imageUri,
        opts: {
          familiaId: latestAssignment.tarefas.familia_id,
          childName: profile?.nome ?? '',
          taskTitle: latestAssignment.tarefas.titulo,
          taskId: latestAssignment.tarefas.id,
        },
      });
    } catch (error_) {
      setCompletionError(
        error_ instanceof Error
          ? error_.message
          : 'Não foi possível concluir a tarefa agora.',
      );
    }
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
    const cancellationState = getAssignmentCancellationState(latestAssignment, latestAssignment.tarefas);
    if (!cancellationState.canCancel) {
      if (cancellationState.reason) {
        setCancelError(cancellationState.reason);
      }
      return;
    }

    Alert.alert(
      'Cancelar envio?',
      'A atividade voltará para pendente e poderá ser ajustada antes de um novo envio.',
      [
        { text: 'Manter envio', style: 'cancel' },
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
        <ScreenHeader title="Detalhe" onBack={() => router.back()} backLabel="Tarefas" role="filho" />
        <View style={styles.center}>
          <EmptyState error={error?.message ?? 'Tarefa não encontrada.'} onRetry={() => refetch()} />
        </View>
      </View>
    );
  }

  const task = assignment.tarefas;
  const completionState = getAssignmentCompletionState(assignment, task);
  const cancellationState = getAssignmentCancellationState(assignment, task);
  let inactiveTaskMessage: string | null = null;
  if (task.ativo === false && assignment.status !== 'pendente') {
    inactiveTaskMessage = assignment.status === 'aguardando_validacao'
      ? 'Esta tarefa foi desativada pelo responsável. O envio atual segue apenas para acompanhamento e não pode mais ser alterado.'
      : 'Esta tarefa foi desativada pelo responsável. Volte para a lista para acompanhar as demais tarefas.';
  }
  const footer = assignment.status === 'rejeitada'
    ? undefined
    : (
      <StatusFooter
        assignment={assignment}
        completing={completeMutation.isPending}
        canceling={cancelMutation.isPending}
        completionReason={completionState.reason}
        completionError={completionError}
        cancelError={cancelError}
        cancelReason={cancellationState.reason}
        onComplete={handleComplete}
        onCancelSubmission={handleCancelSubmission}
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
      <View style={[styles.statusBadge, { backgroundColor: getAssignmentStatusColor(assignment.status, colors) }]}>
        <Text style={[styles.statusBadgeText, { color: colors.text.inverse }]}>{getAssignmentStatusLabel(assignment.status)}</Text>
      </View>

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
          <View style={styles.pointsTag}>
            <Text style={styles.pointsText}>{getAssignmentPoints(assignment)} pts</Text>
          </View>
        </View>
        {task.descricao ? <Text style={styles.description}>{task.descricao}</Text> : null}
        <View style={styles.metaRow}>
          {task.frequencia === 'diaria' ? (
            <RefreshCw size={12} color={colors.text.muted} strokeWidth={2} />
          ) : null}
          <Text style={styles.meta}>
            {task.frequencia === 'diaria' ? 'Diária' : 'Única'}
          </Text>
        </View>
        {task.exige_evidencia ? (
          <View style={styles.evidenceTag}>
            <View style={styles.evidenceTagRow}>
              <Camera size={12} color={colors.semantic.warningText} strokeWidth={2} />
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
        onImgError={() => { setImgLoading(false); setImgError(true); }}
        onImagePress={(url) => setFullscreenImageUrl(url)}
        colors={colors}
        styles={styles}
      />

      {assignment.nota_rejeicao ? (
        <View style={styles.rejectionNoteBox}>
          <Text style={styles.rejectionNoteLabel}>Motivo da rejeição:</Text>
          <Text style={styles.rejectionNoteText}>{assignment.nota_rejeicao}</Text>
          <Text style={styles.rejectionNoteHint}>Converse com o responsável para alinhar os próximos passos.</Text>
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
    feedbackWrapper: { marginBottom: spacing['4'] },
    card: {
      backgroundColor: colors.bg.surface,
      borderRadius: radii.xl,
      padding: spacing['4'],
      marginBottom: spacing['4'],
      ...shadows.card,
    },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing['2'] },
    cardTitle: { flex: 1, fontSize: typography.size.lg, fontFamily: typography.family.bold, color: colors.text.primary, marginRight: spacing['2'] },
    pointsTag: { backgroundColor: colors.accent.filhoBg, borderRadius: radii.md, paddingVertical: spacing['1'], paddingHorizontal: spacing['2'] },
    pointsText: { fontSize: typography.size.sm, fontFamily: typography.family.bold, color: colors.accent.filho },
    description: { fontSize: typography.size.sm, color: colors.text.secondary, marginBottom: spacing['2'], lineHeight: 20 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'] },
    meta: { fontSize: typography.size.xs, color: colors.text.muted },
    evidenceTag: {
      backgroundColor: colors.semantic.warningBg,
      borderRadius: radii.sm,
      paddingVertical: spacing['1'],
      paddingHorizontal: spacing['2'],
      alignSelf: 'flex-start',
      marginTop: spacing['2'],
    },
    evidenceTagRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'] },
    evidenceTagText: { fontSize: typography.size.xs, color: colors.semantic.warningText, fontFamily: typography.family.semibold },
    evidenceBox: { marginBottom: spacing['4'] },
    evidenceLabel: { fontSize: typography.size.xs, fontFamily: typography.family.semibold, color: colors.text.secondary, marginBottom: spacing['2'] },
    evidenceImgWrapper: { width: '100%', height: 220, borderRadius: radii.xl, overflow: 'hidden' },
    evidenceImg: { width: '100%', height: 220 },
    evidenceLoading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.muted },
    evidenceFallback: { alignItems: 'center', justifyContent: 'center' },
    evidenceFallbackText: { fontSize: typography.size.sm, fontFamily: typography.family.medium, textAlign: 'center' },
    rejectionNoteBox: { backgroundColor: colors.semantic.errorBg, borderRadius: radii.xl, padding: spacing['3'], marginBottom: spacing['4'] },
    rejectionNoteLabel: { fontSize: typography.size.xs, fontFamily: typography.family.bold, color: colors.semantic.error, marginBottom: spacing['1'] },
    rejectionNoteText: { fontSize: typography.size.sm, color: colors.text.primary, marginBottom: spacing['2'] },
    rejectionNoteHint: { fontSize: typography.size.xs, color: colors.text.muted, fontStyle: 'italic' },
    completeBtn: { backgroundColor: colors.accent.filho, borderRadius: radii.xl, paddingVertical: spacing['4'], alignItems: 'center', marginTop: spacing['2'], minHeight: 48, justifyContent: 'center' },
    completeBtnInner: { flexDirection: 'row', alignItems: 'center', gap: spacing['1.5'] },
    disabledBtn: { opacity: 0.6 },
    completeBtnText: { fontSize: typography.size.md, fontFamily: typography.family.bold },
    footerMessage: { marginTop: spacing['2'] },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1.5'] },
    awaitingBox: { backgroundColor: colors.accent.filhoBg, borderRadius: radii.xl, padding: spacing['3'], alignItems: 'center', marginTop: spacing['2'] },
    awaitingText: { fontSize: typography.size.sm, color: colors.accent.filho, fontFamily: typography.family.semibold },
    approvedBox: { backgroundColor: colors.semantic.successBg, borderRadius: radii.xl, padding: spacing['3'], alignItems: 'center', marginTop: spacing['2'] },
    approvedText: { fontSize: typography.size.sm, color: colors.semantic.success, fontFamily: typography.family.semibold, textAlign: 'center' },
  });
}
