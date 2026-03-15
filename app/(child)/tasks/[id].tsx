import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
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
  getChildAssignment,
  completeAssignment,
  getStatusLabel,
  getStatusColor,
  type ChildAssignment,
} from '@lib/tasks';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';

type EvidenceSectionProps = Readonly<{
  evidenceUrl: string | null | undefined;
  imgLoading: boolean;
  imgError: boolean;
  onImgLoadStart: () => void;
  onImgLoadEnd: () => void;
  onImgError: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}>;

function EvidenceSection({ evidenceUrl, imgLoading, imgError, onImgLoadStart, onImgLoadEnd, onImgError, colors, styles }: EvidenceSectionProps) {
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
      <View style={styles.evidenceImgWrapper}>
        <Image
          source={{ uri: evidenceUrl }}
          style={styles.evidenceImg}
          resizeMode="cover"
          onLoadStart={onImgLoadStart}
          onLoadEnd={onImgLoadEnd}
          onError={onImgError}
        />
        {imgLoading ? (
          <View style={styles.evidenceLoading}>
            <ActivityIndicator size="small" color={colors.accent.filho} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

type StatusFooterProps = Readonly<{
  assignment: ChildAssignment;
  completing: boolean;
  completionError: string | null;
  onComplete: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}>;

function StatusFooter({ assignment, completing, completionError, onComplete, colors, styles }: StatusFooterProps) {
  const task = assignment.tarefas;

  if (assignment.status === 'pendente') {
    return (
      <>
        {completionError ? <Text style={styles.errorText}>{completionError}</Text> : null}
        <Pressable
          style={[styles.completeBtn, completing && styles.disabledBtn]}
          onPress={onComplete}
          disabled={completing}
        >
          {completing
            ? <ActivityIndicator color="#fff" />
            : <View style={styles.completeBtnInner}>
                {task.exige_evidencia
                  ? <Camera size={16} color="#fff" strokeWidth={2} />
                  : <CheckCircle2 size={16} color="#fff" strokeWidth={2} />}
                <Text style={styles.completeBtnText}>
                  {task.exige_evidencia ? 'Tirar foto e concluir' : 'Concluir tarefa'}
                </Text>
              </View>
          }
        </Pressable>
      </>
    );
  }

  if (assignment.status === 'aguardando_validacao') {
    return (
      <View style={styles.awaitingBox}>
        <View style={styles.statusRow}>
          <Clock size={14} color={colors.accent.filho} strokeWidth={2} />
          <Text style={styles.awaitingText}>Aguardando validação do responsável</Text>
        </View>
      </View>
    );
  }

  if (assignment.status === 'aprovada') {
    return (
      <View style={styles.approvedBox}>
        <View style={styles.statusRow}>
          <Trophy size={14} color={colors.semantic.success} strokeWidth={2} />
          <Text style={styles.approvedText}>Parabéns! {task.pontos} pontos creditados no seu saldo.</Text>
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

  const [assignment, setAssignment] = useState<ChildAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await getChildAssignment(id);
      if (error) setError(error);
      else setAssignment(data);
    } catch {
      setError('Não foi possível carregar a tarefa agora.');
      setAssignment(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  async function handleComplete() {
    if (!assignment) return;
    setCompletionError(null);

    try {
      const imageUri = assignment.tarefas.exige_evidencia
        ? await pickEvidenceImage()
        : null;

      if (assignment.tarefas.exige_evidencia && !imageUri) {
        return;
      }

      setCompleting(true);
      const { error } = await completeAssignment(assignment.id, imageUri);
      if (error) setCompletionError(error);
      else await loadData();
    } catch (completionError) {
      setCompletionError(
        completionError instanceof Error
          ? completionError.message
          : 'Não foi possível concluir a tarefa agora.',
      );
    } finally {
      setCompleting(false);
    }
  }

  if (loading) {
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
          <EmptyState error={error ?? 'Tarefa não encontrada.'} onRetry={loadData} />
        </View>
      </View>
    );
  }

  const task = assignment.tarefas;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Detalhe" onBack={() => router.back()} backLabel="Tarefas" role="filho" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(assignment.status) }]}>
          <Text style={styles.statusBadgeText}>{getStatusLabel(assignment.status)}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.cardTitle}>{task.titulo}</Text>
            <View style={styles.pointsTag}>
              <Text style={styles.pointsText}>{task.pontos} pts</Text>
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
          {task.exige_evidencia && (
            <View style={styles.evidenceTag}>
              <View style={styles.evidenceTagRow}>
                <Camera size={12} color={colors.semantic.warningText} strokeWidth={2} />
                <Text style={styles.evidenceTagText}>Enviar foto como prova</Text>
              </View>
            </View>
          )}
        </View>

        <EvidenceSection
          evidenceUrl={assignment.evidencia_url}
          imgLoading={imgLoading}
          imgError={imgError}
          onImgLoadStart={() => setImgLoading(true)}
          onImgLoadEnd={() => setImgLoading(false)}
          onImgError={() => { setImgLoading(false); setImgError(true); }}
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

        <StatusFooter
          assignment={assignment}
          completing={completing}
          completionError={completionError}
          onComplete={handleComplete}
          colors={colors}
          styles={styles}
        />
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['6'] },
    container: { flex: 1 },
    scrollContent: { padding: spacing['4'], paddingBottom: spacing['12'] },
    statusBadge: {
      borderRadius: radii.lg,
      paddingVertical: spacing['2'],
      paddingHorizontal: spacing['4'],
      alignSelf: 'center',
      marginBottom: spacing['4'],
    },
    statusBadgeText: { color: '#fff', fontSize: typography.size.sm, fontFamily: typography.family.bold },
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
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    meta: { fontSize: typography.size.xs, color: colors.text.muted },
    evidenceTag: {
      backgroundColor: colors.semantic.warningBg,
      borderRadius: radii.sm,
      paddingVertical: spacing['1'],
      paddingHorizontal: spacing['2'],
      alignSelf: 'flex-start',
      marginTop: spacing['2'],
    },
    evidenceTagRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
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
    errorText: { color: colors.semantic.error, fontSize: typography.size.sm, textAlign: 'center', marginBottom: spacing['3'], marginTop: spacing['2'] },
    completeBtn: { backgroundColor: colors.accent.filho, borderRadius: radii.xl, paddingVertical: spacing['4'], alignItems: 'center', marginTop: spacing['2'], minHeight: 48, justifyContent: 'center' },
    completeBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    disabledBtn: { opacity: 0.6 },
    completeBtnText: { color: '#fff', fontSize: typography.size.md, fontFamily: typography.family.bold },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    awaitingBox: { backgroundColor: colors.accent.filhoBg, borderRadius: radii.xl, padding: spacing['3'], alignItems: 'center', marginTop: spacing['2'] },
    awaitingText: { fontSize: typography.size.sm, color: colors.accent.filho, fontFamily: typography.family.semibold },
    approvedBox: { backgroundColor: colors.semantic.successBg, borderRadius: radii.xl, padding: spacing['3'], alignItems: 'center', marginTop: spacing['2'] },
    approvedText: { fontSize: typography.size.sm, color: colors.semantic.success, fontFamily: typography.family.semibold, textAlign: 'center' },
  });
}
