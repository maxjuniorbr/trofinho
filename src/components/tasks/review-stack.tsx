import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useCallback, useMemo, useState } from 'react';
import { Calendar, Camera, Check, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { BottomSheetOverlay } from '@/components/ui/bottom-sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { HeaderIconButton } from '@/components/ui/screen-header';
import { InlineMessage } from '@/components/ui/inline-message';
import { Input } from '@/components/ui/input';
import { TaskPointsPill } from '@/components/tasks/task-points-pill';
import { useApproveAssignment, usePendingValidations, useRejectAssignment } from '@/hooks/queries';
import type { PendingValidationItem } from '@lib/tasks';
import { localizeRpcError } from '@lib/api-error';
import { formatDateShort } from '@lib/utils';
import { hapticLight, hapticSuccess } from '@lib/haptics';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';

/* ── Constants ── */

const SWIPE_THRESHOLD = 90;
const LABEL_SHOW_THRESHOLD = 30;
const EXIT_DISTANCE = 500;

const REJECTION_REASONS = [
  { key: 'incompleta', label: 'Tarefa incompleta' },
  { key: 'foto', label: 'Foto ilegível' },
  { key: 'incorreto', label: 'Não corresponde à tarefa' },
  { key: 'outro', label: 'Outro motivo' },
] as const;

type ReviewStackProps = Readonly<{
  visible: boolean;
  onClose: () => void;
}>;

/* ── Rejection Bottom Sheet (inline overlay, not a nested Modal) ── */

type RejectionSheetProps = Readonly<{
  visible: boolean;
  taskTitle: string;
  loading: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  error: string | null;
}>;

function RejectionSheet({
  visible,
  taskTitle,
  loading,
  onConfirm,
  onCancel,
  error,
}: RejectionSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [customNote, setCustomNote] = useState('');

  const handleConfirm = () => {
    if (!selectedKey) return;
    const reason =
      selectedKey === 'outro'
        ? customNote.trim()
        : (REJECTION_REASONS.find((r) => r.key === selectedKey)?.label ?? '');
    if (!reason) return;
    onConfirm(reason);
  };

  const handleCancel = () => {
    setSelectedKey(null);
    setCustomNote('');
    onCancel();
  };

  const isValid = selectedKey !== null && (selectedKey !== 'outro' || customNote.trim().length > 0);

  if (!visible) return null;

  return (
    <BottomSheetOverlay
      visible={visible}
      onClose={handleCancel}
      sheetStyle={sheetStyles.sheet}
      contentStyle={[
        sheetStyles.sheetContent,
        { paddingBottom: Math.max(insets.bottom, spacing['6']) },
      ]}
      closeLabel="Fechar rejeição"
    >
      <Text style={[sheetStyles.sheetTitle, { color: colors.text.primary }]}>
        Por que está rejeitando?
      </Text>
      <Text style={[sheetStyles.sheetSubtitle, { color: colors.text.muted }]} numberOfLines={2}>
        {taskTitle}
      </Text>

      <View style={sheetStyles.reasonList}>
        {REJECTION_REASONS.map((reason) => {
          const isSelected = selectedKey === reason.key;
          return (
            <Pressable
              key={reason.key}
              onPress={() => setSelectedKey(reason.key)}
              accessibilityRole="button"
              accessibilityLabel={reason.label}
              accessibilityState={{ selected: isSelected }}
              style={[
                sheetStyles.reasonChip,
                {
                  backgroundColor: isSelected ? colors.accent.admin : colors.bg.muted,
                  borderColor: isSelected ? colors.accent.admin : colors.border.subtle,
                },
              ]}
            >
              <Text
                style={[
                  sheetStyles.reasonLabel,
                  { color: isSelected ? colors.text.inverse : colors.text.primary },
                ]}
              >
                {reason.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedKey === 'outro' ? (
        <Input
          label="Descreva o motivo *"
          value={customNote}
          onChangeText={setCustomNote}
          multiline
          numberOfLines={3}
          maxLength={500}
          placeholder="Ex: A foto está borrada."
          noMarginBottom
          accessibilityLabel="Motivo personalizado"
        />
      ) : null}

      {error ? <InlineMessage message={error} variant="error" /> : null}

      <View style={sheetStyles.sheetActions}>
        <View style={sheetStyles.flex}>
          <Button label="Cancelar" variant="secondary" onPress={handleCancel} disabled={loading} />
        </View>
        <View style={sheetStyles.flex}>
          <Button
            label="Rejeitar"
            loadingLabel="Rejeitando…"
            onPress={handleConfirm}
            loading={loading}
            variant="danger"
            disabled={!isValid}
          />
        </View>
      </View>
    </BottomSheetOverlay>
  );
}

/* ── Main Review Stack ── */

export function ReviewStack({ visible, onClose }: ReviewStackProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data: items = [], isLoading, error, refetch } = usePendingValidations();
  const approveMutation = useApproveAssignment();
  const rejectMutation = useRejectAssignment();

  const [index, setIndex] = useState(0);
  const [showRejectionSheet, setShowRejectionSheet] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const translateX = useSharedValue(0);
  const isExiting = useSharedValue(false);

  const total = items.length;
  const current: PendingValidationItem | undefined = items[index];

  const reset = useCallback(() => {
    setIndex(0);
    setShowRejectionSheet(false);
    setActionError(null);
    translateX.value = 0;
    isExiting.value = false;
  }, [translateX, isExiting]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const advance = useCallback(() => {
    translateX.value = 0;
    isExiting.value = false;
    setShowRejectionSheet(false);
    setActionError(null);
    setIndex((i) => i + 1);
  }, [translateX, isExiting]);

  /* ── Approve ── */

  const fireApprove = useCallback(() => {
    if (!current) return;
    setActionError(null);
    approveMutation.mutate(
      {
        assignmentId: current.id,
        opts: {
          familiaId: current.tarefas.familia_id,
          userId: current.filhos.usuario_id,
          taskTitle: current.tarefas.titulo,
        },
      },
      {
        onSuccess: () => advance(),
        onError: (err) => {
          translateX.value = withSpring(0);
          isExiting.value = false;
          setActionError(localizeRpcError(err.message));
        },
      },
    );
  }, [current, approveMutation, advance, translateX, isExiting]);

  const triggerApprove = useCallback(() => {
    hapticSuccess();
    isExiting.value = true;
    translateX.value = withTiming(EXIT_DISTANCE, { duration: 200 }, (finished) => {
      if (finished) runOnJS(fireApprove)();
    });
  }, [fireApprove, translateX, isExiting]);

  /* ── Reject ── */

  const openRejectionSheet = useCallback(() => {
    hapticLight();
    setActionError(null);
    setShowRejectionSheet(true);
  }, []);

  const handleConfirmReject = useCallback(
    (reason: string) => {
      if (!current) return;
      setActionError(null);
      rejectMutation.mutate(
        {
          assignmentId: current.id,
          note: reason,
          opts: {
            familiaId: current.tarefas.familia_id,
            userId: current.filhos.usuario_id,
            taskTitle: current.tarefas.titulo,
          },
        },
        {
          onSuccess: () => advance(),
          onError: (err) => setActionError(localizeRpcError(err.message)),
        },
      );
    },
    [current, rejectMutation, advance],
  );

  /* ── Swipe gesture ── */

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .onUpdate((e) => {
      'worklet';
      if (isExiting.value) return;
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      'worklet';
      if (isExiting.value) return;
      if (e.translationX > SWIPE_THRESHOLD) {
        runOnJS(triggerApprove)();
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withSpring(0);
        runOnJS(openRejectionSheet)();
      } else {
        translateX.value = withSpring(0);
      }
    });

  const cardAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const borderColor = interpolateColor(
      translateX.value,
      [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD],
      [colors.semantic.error, colors.border.subtle, colors.semantic.success],
    );
    return {
      transform: [{ translateX: translateX.value }, { rotate: `${translateX.value / 20}deg` }],
      opacity: interpolate(Math.abs(translateX.value), [0, 300], [1, 0.6], 'clamp'),
      borderColor,
    };
  });

  const approveOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, LABEL_SHOW_THRESHOLD, SWIPE_THRESHOLD, SWIPE_THRESHOLD * 1.8],
      [0, 0, 0.65, 0.95],
      'clamp',
    ),
  }));

  const rejectOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD * 1.8, -SWIPE_THRESHOLD, -LABEL_SHOW_THRESHOLD, 0],
      [0.95, 0.65, 0, 0],
      'clamp',
    ),
  }));

  const isProcessing = approveMutation.isPending || rejectMutation.isPending;

  /* ── Render ── */

  const renderHeader = (subtitle: string) => (
    <View style={styles.header}>
      <HeaderIconButton icon={X} onPress={handleClose} accessibilityLabel="Fechar revisão" />
      <View style={styles.headerCenter}>
        <Text style={[styles.headerLabel, { color: colors.text.muted }]}>Revisar tarefas</Text>
        <Text style={[styles.headerCount, { color: colors.text.primary }]}>{subtitle}</Text>
      </View>
      <View style={styles.headerSpacer} />
    </View>
  );

  const renderBody = () => {
    if (isLoading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent.admin} size="large" />
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.center}>
          <EmptyState error={localizeRpcError(error.message)} onRetry={() => refetch()} />
        </View>
      );
    }
    if (!current) {
      return (
        <View style={styles.center}>
          <View style={[styles.doneCircle, { backgroundColor: colors.semantic.successBg }]}>
            <Check size={36} color={colors.semantic.success} strokeWidth={3} />
          </View>
          <Text style={[styles.doneTitle, { color: colors.text.primary }]}>Revisão concluída.</Text>
          <Text style={[styles.doneSubtitle, { color: colors.text.muted }]}>
            Você passou por todas as entregas da fila.
          </Text>
          <View style={styles.doneButtonWrapper}>
            <Button label="Voltar para a lista" onPress={handleClose} />
          </View>
        </View>
      );
    }

    const reviewIndex = Math.min(index + 1, total);
    const progress = total === 0 ? 0 : Math.min(index / total, 1);
    const submittedDate = current.concluida_em ? formatDateShort(current.concluida_em) : null;
    const competenciaDate = current.competencia ? formatDateShort(current.competencia) : null;

    return (
      <>
        {renderHeader(`${reviewIndex} de ${total}`)}

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress * 100}%`, backgroundColor: colors.accent.admin },
            ]}
          />
        </View>

        {/* Card stack area */}
        <View style={styles.cardArea}>
          {/* Peek card behind */}
          {items[index + 1] ? (
            <View
              style={[
                styles.peekCard,
                shadows.card,
                { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
              ]}
            />
          ) : null}

          {/* Active card with swipe */}
          <GestureDetector gesture={panGesture}>
            <Animated.View
              style={[
                styles.card,
                shadows.card,
                { backgroundColor: colors.bg.surface },
                cardAnimatedStyle,
              ]}
            >
              {/* Full-card approve overlay */}
              <Animated.View
                style={[
                  styles.cardOverlay,
                  { backgroundColor: colors.semantic.successBg },
                  approveOverlayStyle,
                ]}
                pointerEvents="none"
              >
                <View
                  style={[styles.overlayIconCircle, { backgroundColor: colors.semantic.success }]}
                >
                  <Check size={36} color={colors.text.inverse} strokeWidth={3} />
                </View>
                <Text style={[styles.overlayLabel, { color: colors.semantic.successText }]}>
                  APROVAR
                </Text>
              </Animated.View>

              {/* Full-card reject overlay */}
              <Animated.View
                style={[
                  styles.cardOverlay,
                  { backgroundColor: colors.semantic.errorBg },
                  rejectOverlayStyle,
                ]}
                pointerEvents="none"
              >
                <View
                  style={[styles.overlayIconCircle, { backgroundColor: colors.semantic.error }]}
                >
                  <X size={36} color={colors.text.inverse} strokeWidth={3} />
                </View>
                <Text style={[styles.overlayLabel, { color: colors.semantic.errorText }]}>
                  REJEITAR
                </Text>
              </Animated.View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                overScrollMode="never"
                contentContainerStyle={styles.cardContent}
              >
                <Text style={[styles.childLabel, { color: colors.text.muted }]} numberOfLines={1}>
                  {current.filhos.nome}
                </Text>
                <Text style={[styles.taskTitle, { color: colors.text.primary }]} numberOfLines={3}>
                  {current.tarefas.titulo}
                </Text>

                {current.tarefas.descricao ? (
                  <Text style={[styles.taskDesc, { color: colors.text.muted }]}>
                    {current.tarefas.descricao}
                  </Text>
                ) : null}

                {current.evidencia_url ? (
                  <View style={[styles.evidenceBox, { backgroundColor: colors.bg.muted }]}>
                    <Image
                      source={current.evidencia_url}
                      style={styles.evidenceImg}
                      contentFit="cover"
                      transition={200}
                      accessibilityLabel={`Comprovação enviada por ${current.filhos.nome}`}
                    />
                    <View style={[styles.evidenceBadge, { backgroundColor: colors.bg.elevated }]}>
                      <Camera size={10} color={colors.text.inverse} strokeWidth={2.5} />
                      <Text style={[styles.evidenceBadgeText, { color: colors.text.inverse }]}>
                        Comprovação
                      </Text>
                    </View>
                  </View>
                ) : null}

                <View style={styles.metaRow}>
                  <TaskPointsPill points={current.pontos_snapshot} />
                  {competenciaDate ? (
                    <View style={[styles.tag, { backgroundColor: colors.bg.muted }]}>
                      <Calendar size={12} color={colors.text.muted} strokeWidth={2} />
                      <Text style={[styles.tagText, { color: colors.text.muted }]}>
                        {competenciaDate}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {submittedDate ? (
                  <Text style={[styles.submittedLabel, { color: colors.text.muted }]}>
                    Enviada em {submittedDate}
                  </Text>
                ) : null}
              </ScrollView>
            </Animated.View>
          </GestureDetector>
        </View>

        {actionError && !showRejectionSheet ? (
          <View style={styles.errorBar}>
            <InlineMessage message={actionError} variant="error" />
          </View>
        ) : null}

        {/* Bottom action bar */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing['4']) }]}>
          <View style={styles.circleRow}>
            <View style={styles.actionColumn}>
              <Pressable
                onPress={openRejectionSheet}
                disabled={isProcessing}
                accessibilityRole="button"
                accessibilityLabel="Rejeitar tarefa"
                style={[styles.circleBtn, styles.circleBtnReject]}
              >
                {isProcessing && rejectMutation.isPending ? (
                  <ActivityIndicator color={colors.semantic.error} size="small" />
                ) : (
                  <X size={28} color={colors.semantic.error} strokeWidth={3} />
                )}
              </Pressable>
              <Text style={[styles.actionBtnLabel, { color: colors.semantic.error }]}>
                Rejeitar
              </Text>
            </View>
            <View style={styles.actionColumn}>
              <Pressable
                onPress={triggerApprove}
                disabled={isProcessing}
                accessibilityRole="button"
                accessibilityLabel="Aprovar tarefa"
                style={[styles.circleBtn, styles.circleBtnApprove]}
              >
                {isProcessing && approveMutation.isPending ? (
                  <ActivityIndicator color={colors.semantic.success} size="small" />
                ) : (
                  <Check size={28} color={colors.semantic.success} strokeWidth={3} />
                )}
              </Pressable>
              <Text style={[styles.actionBtnLabel, { color: colors.semantic.success }]}>
                Aprovar
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => advance()}
            accessibilityRole="button"
            accessibilityLabel="Pular esta tarefa"
            style={styles.skip}
            disabled={isProcessing}
          >
            <Text style={[styles.skipLabel, { color: colors.text.muted }]}>Pular por agora</Text>
          </Pressable>
        </View>

        {/* Rejection sheet overlay */}
        <RejectionSheet
          key={current.id}
          visible={showRejectionSheet}
          taskTitle={current.tarefas.titulo}
          loading={rejectMutation.isPending}
          onConfirm={handleConfirmReject}
          onCancel={() => {
            setShowRejectionSheet(false);
            setActionError(null);
          }}
          error={actionError}
        />
      </>
    );
  };

  const showStandaloneHeader = isLoading || !!error;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View
          style={[styles.screen, { backgroundColor: colors.bg.canvas, paddingTop: insets.top }]}
        >
          {showStandaloneHeader ? renderHeader('') : null}
          {renderBody()}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/* ── Sheet Styles (static, no theme dependency) ── */

const sheetStyles = StyleSheet.create({
  sheet: {
    maxHeight: '86%',
  },
  sheetContent: { gap: spacing['4'] },
  sheetTitle: {
    fontSize: typography.size.lg,
    fontFamily: typography.family.bold,
  },
  sheetSubtitle: {
    fontSize: typography.size.sm,
    fontFamily: typography.family.medium,
  },
  reasonList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing['2'],
  },
  reasonChip: {
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['2'],
    borderRadius: radii.full,
    borderWidth: 1,
  },
  reasonLabel: {
    fontSize: typography.size.sm,
    fontFamily: typography.family.semibold,
  },
  sheetActions: { flexDirection: 'row', gap: spacing['2'] },
  flex: { flex: 1 },
});

/* ── Component Styles (theme-dependent) ── */

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    gestureRoot: { flex: 1 },
    screen: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing['4'],
      paddingBottom: spacing['3'],
    },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerLabel: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    headerCount: {
      fontSize: typography.size.md,
      fontFamily: typography.family.bold,
      marginTop: spacing['0.5'],
    },
    headerSpacer: { width: 40 },
    progressTrack: {
      height: 4,
      marginHorizontal: spacing['4'],
      marginBottom: spacing['4'],
      backgroundColor: colors.bg.muted,
      borderRadius: radii.full,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: radii.full },
    cardArea: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing['4'],
    },
    peekCard: {
      position: 'absolute',
      width: '88%',
      maxWidth: 345,
      height: 140,
      borderRadius: radii.xl,
      borderWidth: 1,
      opacity: 0.4,
      transform: [{ scale: 0.95 }, { translateY: -12 }],
    },
    card: {
      width: '100%',
      maxWidth: 360,
      maxHeight: '90%',
      borderRadius: radii.xl,
      borderWidth: 1,
      overflow: 'hidden',
      borderCurve: 'continuous',
    },
    cardContent: {
      padding: spacing['5'],
      gap: spacing['3'],
    },
    cardOverlay: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: radii.xl - 1,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
      gap: spacing['3'],
    },
    overlayIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    overlayLabel: {
      fontSize: typography.size.lg,
      fontFamily: typography.family.extrabold,
      letterSpacing: 2,
    },
    childLabel: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    taskTitle: {
      fontSize: typography.size.lg,
      fontFamily: typography.family.bold,
    },
    taskDesc: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.medium,
      lineHeight: typography.size.sm * 1.5,
    },
    metaRow: { flexDirection: 'row', gap: spacing['2'], flexWrap: 'wrap' },
    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1'],
      borderRadius: radii.md,
      paddingHorizontal: spacing['2'],
      paddingVertical: spacing['1'],
    },
    tagText: { fontSize: typography.size.xs, fontFamily: typography.family.semibold },
    evidenceBox: {
      width: '100%',
      aspectRatio: 16 / 10,
      borderRadius: radii.lg,
      overflow: 'hidden',
    },
    evidenceImg: { width: '100%', height: '100%' },
    evidenceBadge: {
      position: 'absolute',
      top: spacing['2'],
      left: spacing['2'],
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1'],
      paddingHorizontal: spacing['2'],
      paddingVertical: spacing['0.5'],
      borderRadius: radii.md,
      opacity: 0.85,
    },
    evidenceBadgeText: {
      fontSize: 10,
      fontFamily: typography.family.bold,
    },
    submittedLabel: {
      fontSize: 11,
      fontFamily: typography.family.semibold,
    },
    errorBar: { paddingHorizontal: spacing['4'] },
    bottomBar: {
      paddingHorizontal: spacing['5'],
      paddingTop: spacing['4'],
      gap: spacing['3'],
    },
    circleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing['6'],
    },
    circleBtn: {
      width: 64,
      height: 64,
      borderRadius: 32,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    circleBtnReject: {
      borderColor: colors.semantic.error,
      backgroundColor: colors.semantic.errorBg,
    },
    circleBtnApprove: {
      borderColor: colors.semantic.success,
      backgroundColor: colors.semantic.successBg,
    },
    actionColumn: {
      alignItems: 'center',
      gap: spacing['1.5'],
    },
    actionBtnLabel: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.bold,
    },
    skip: { alignSelf: 'center', paddingVertical: spacing['1'] },
    skipLabel: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.semibold,
      textDecorationLine: 'underline',
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['6'] },
    doneCircle: {
      width: 80,
      height: 80,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing['4'],
    },
    doneTitle: {
      fontSize: typography.size.xl,
      fontFamily: typography.family.bold,
      marginBottom: spacing['2'],
    },
    doneButtonWrapper: { width: '100%', maxWidth: 240 },
    doneSubtitle: {
      fontSize: typography.size.md,
      textAlign: 'center',
      marginBottom: spacing['6'],
    },
  });
}
