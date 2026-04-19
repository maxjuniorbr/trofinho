import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useCallback, useMemo, useState } from 'react';
import { Camera, Check, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { HeaderIconButton } from '@/components/ui/screen-header';
import { InlineMessage } from '@/components/ui/inline-message';
import { Input } from '@/components/ui/input';
import { TaskPointsPill } from '@/components/tasks/task-points-pill';
import { useApproveAssignment, usePendingValidations, useRejectAssignment } from '@/hooks/queries';
import type { PendingValidationItem } from '@lib/tasks';
import { localizeRpcError } from '@lib/api-error';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';

type ReviewStackProps = Readonly<{
  visible: boolean;
  onClose: () => void;
}>;

type Mode = 'view' | 'rejecting';

export function ReviewStack({ visible, onClose }: ReviewStackProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data: items = [], isLoading, error, refetch } = usePendingValidations();
  const approveMutation = useApproveAssignment();
  const rejectMutation = useRejectAssignment();

  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<Mode>('view');
  const [note, setNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const total = items.length;
  const current: PendingValidationItem | undefined = items[index];

  const reset = useCallback(() => {
    setIndex(0);
    setMode('view');
    setNote('');
    setActionError(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const advance = useCallback(() => {
    setMode('view');
    setNote('');
    setActionError(null);
    setIndex((i) => i + 1);
  }, []);

  const handleApprove = () => {
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
        onError: (err) => setActionError(localizeRpcError(err.message)),
      },
    );
  };

  const handleConfirmReject = () => {
    if (!current) return;
    if (!note.trim()) {
      setActionError('Informe o motivo da rejeição.');
      return;
    }
    setActionError(null);
    rejectMutation.mutate(
      {
        assignmentId: current.id,
        note: note.trim(),
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
  };

  const isProcessing = approveMutation.isPending || rejectMutation.isPending;

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

        <View style={styles.cardsArea}>
          {items[index + 1] ? (
            <View
              style={[
                styles.peekCard,
                shadows.card,
                { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
              ]}
            />
          ) : null}

          <View
            style={[
              styles.card,
              shadows.card,
              { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
            ]}
          >
            <Text style={[styles.childLabel, { color: colors.text.muted }]} numberOfLines={1}>
              {current.filhos.nome}
            </Text>
            <Text style={[styles.taskTitle, { color: colors.text.primary }]} numberOfLines={3}>
              {current.tarefas.titulo}
            </Text>

            <View style={styles.metaRow}>
              <TaskPointsPill points={current.pontos_snapshot} />
              {current.tarefas.exige_evidencia ? (
                <View style={[styles.tag, { backgroundColor: colors.bg.muted }]}>
                  <Camera size={12} color={colors.text.muted} strokeWidth={2} />
                  <Text style={[styles.tagText, { color: colors.text.muted }]}>Foto</Text>
                </View>
              ) : null}
            </View>

            {current.evidencia_url ? (
              <View style={[styles.evidenceBox, { backgroundColor: colors.bg.muted }]}>
                <Image
                  source={current.evidencia_url}
                  style={styles.evidenceImg}
                  contentFit="cover"
                  transition={200}
                  accessibilityLabel={`Comprovação enviada por ${current.filhos.nome}`}
                />
              </View>
            ) : null}

            {actionError ? (
              <View style={styles.errorWrapper}>
                <InlineMessage message={actionError} variant="error" />
              </View>
            ) : null}

            {mode === 'rejecting' ? (
              <View style={styles.actions}>
                <Input
                  label="Motivo da rejeição *"
                  value={note}
                  onChangeText={setNote}
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                  placeholder="Ex: A foto está borrada, tente de novo com mais luz."
                  noMarginBottom
                  accessibilityLabel="Motivo da rejeição"
                />
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <Button
                      label="Cancelar"
                      variant="secondary"
                      onPress={() => {
                        setMode('view');
                        setNote('');
                        setActionError(null);
                      }}
                      disabled={isProcessing}
                    />
                  </View>
                  <View style={styles.flex}>
                    <Button
                      label="Rejeitar"
                      loadingLabel="Rejeitando…"
                      onPress={handleConfirmReject}
                      loading={rejectMutation.isPending}
                      variant="danger"
                    />
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Button
                    label="Rejeitar"
                    onPress={() => {
                      setMode('rejecting');
                      setActionError(null);
                    }}
                    variant="danger"
                    disabled={isProcessing}
                  />
                </View>
                <View style={styles.flex}>
                  <Button
                    label="Aprovar"
                    loadingLabel="Aprovando…"
                    onPress={handleApprove}
                    loading={approveMutation.isPending}
                  />
                </View>
              </View>
            )}

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
        </View>
      </>
    );
  };

  const showStandaloneHeader = isLoading || !!error;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.screen, { backgroundColor: colors.bg.canvas, paddingTop: insets.top }]}>
        {showStandaloneHeader ? renderHeader('') : null}
        {renderBody()}
      </View>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
    },
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
    cardsArea: {
      flex: 1,
      paddingHorizontal: spacing['4'],
      paddingVertical: spacing['5'],
      alignItems: 'center',
      justifyContent: 'center',
    },
    peekCard: {
      position: 'absolute',
      top: spacing['8'],
      left: spacing['6'],
      right: spacing['6'],
      height: 120,
      borderRadius: radii.xl,
      borderWidth: 1,
      opacity: 0.5,
      transform: [{ scale: 0.94 }],
    },
    card: {
      width: '100%',
      maxWidth: 360,
      borderRadius: radii.xl,
      borderWidth: 1,
      padding: spacing['5'],
      gap: spacing['3'],
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
    actions: { gap: spacing['3'] },
    row: { flexDirection: 'row', gap: spacing['2'] },
    flex: { flex: 1 },
    skip: { alignSelf: 'center', paddingVertical: spacing['2'] },
    skipLabel: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.semibold,
      textDecorationLine: 'underline',
    },
    errorWrapper: {},
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
