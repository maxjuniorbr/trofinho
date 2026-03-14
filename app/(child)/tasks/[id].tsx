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

    if (assignment.tarefas.exige_evidencia) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        setCompletionError('Permissão da câmera negada. Habilite nas configurações do dispositivo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: true,
        aspect: [4, 3],
      });
      if (result.canceled || result.assets.length === 0) return;
      const imageUri = result.assets[0].uri;
      setCompleting(true);
      const { error } = await completeAssignment(assignment.id, imageUri);
      setCompleting(false);
      if (error) setCompletionError(error);
      else await loadData();
    } else {
      setCompleting(true);
      const { error } = await completeAssignment(assignment.id, null);
      setCompleting(false);
      if (error) setCompletionError(error);
      else await loadData();
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
      <View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ScreenHeader title="Detalhe" onBack={() => router.back()} backLabel="Tarefas" role="filho" />
        <EmptyState error={error ?? 'Tarefa não encontrada.'} onRetry={loadData} />
      </View>
    );
  }

  const tarefa = assignment.tarefas;
  const canComplete = assignment.status === 'pendente';

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
            <Text style={styles.cardTitle}>{tarefa.titulo}</Text>
            <View style={styles.pointsTag}>
              <Text style={styles.pointsText}>{tarefa.pontos} pts</Text>
            </View>
          </View>
          {tarefa.descricao ? <Text style={styles.description}>{tarefa.descricao}</Text> : null}
          <Text style={styles.meta}>
            {tarefa.timebox_inicio}
            {' \u2192 '}
            {tarefa.timebox_fim}
          </Text>
          {tarefa.exige_evidencia && (
            <View style={styles.evidenceTag}>
              <Text style={styles.evidenceTagText}>📷 Enviar foto como prova</Text>
            </View>
          )}
        </View>

        {assignment.evidencia_url ? (
          <View style={styles.evidenceBox}>
            <Text style={styles.evidenceLabel}>Foto enviada:</Text>
            <Image source={{ uri: assignment.evidencia_url }} style={styles.evidenceImg} resizeMode="cover" />
          </View>
        ) : null}

        {assignment.nota_rejeicao ? (
          <View style={styles.rejectionNoteBox}>
            <Text style={styles.rejectionNoteLabel}>Motivo da rejeição:</Text>
            <Text style={styles.rejectionNoteText}>{assignment.nota_rejeicao}</Text>
            <Text style={styles.rejectionNoteHint}>Converse com o responsável para alinhar os próximos passos.</Text>
          </View>
        ) : null}

        {canComplete && (
          <>
            {completionError ? <Text style={styles.errorText}>{completionError}</Text> : null}
            <Pressable
              style={[styles.completeBtn, completing && styles.disabledBtn]}
              onPress={handleComplete}
              disabled={completing}
            >
              {completing
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.completeBtnText}>
                    {tarefa.exige_evidencia ? '📷 Tirar foto e concluir' : '✓ Concluir tarefa'}
                  </Text>
              }
            </Pressable>
          </>
        )}

        {assignment.status === 'aguardando_validacao' && (
          <View style={styles.awaitingBox}>
            <Text style={styles.awaitingText}>⏳ Aguardando validação do responsável</Text>
          </View>
        )}

        {assignment.status === 'aprovada' && (
          <View style={styles.approvedBox}>
            <Text style={styles.approvedText}>🏆 Parabéns! {tarefa.pontos} pontos creditados no seu saldo.</Text>
          </View>
        )}
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
    meta: { fontSize: typography.size.xs, color: colors.text.muted },
    evidenceTag: {
      backgroundColor: colors.semantic.warningBg,
      borderRadius: radii.sm,
      paddingVertical: spacing['1'],
      paddingHorizontal: spacing['2'],
      alignSelf: 'flex-start',
      marginTop: spacing['2'],
    },
    evidenceTagText: { fontSize: typography.size.xs, color: colors.semantic.warning, fontFamily: typography.family.semibold },
    evidenceBox: { marginBottom: spacing['4'] },
    evidenceLabel: { fontSize: typography.size.xs, fontFamily: typography.family.semibold, color: colors.text.secondary, marginBottom: spacing['2'] },
    evidenceImg: { width: '100%', height: 220, borderRadius: radii.xl },
    rejectionNoteBox: { backgroundColor: colors.semantic.errorBg, borderRadius: radii.xl, padding: spacing['3'], marginBottom: spacing['4'] },
    rejectionNoteLabel: { fontSize: typography.size.xs, fontFamily: typography.family.bold, color: colors.semantic.error, marginBottom: spacing['1'] },
    rejectionNoteText: { fontSize: typography.size.sm, color: colors.text.primary, marginBottom: spacing['2'] },
    rejectionNoteHint: { fontSize: typography.size.xs, color: colors.text.muted, fontStyle: 'italic' },
    errorText: { color: colors.semantic.error, fontSize: typography.size.sm, textAlign: 'center', marginBottom: spacing['3'], marginTop: spacing['2'] },
    completeBtn: { backgroundColor: colors.accent.filho, borderRadius: radii.xl, paddingVertical: spacing['4'], alignItems: 'center', marginTop: spacing['2'], minHeight: 48 },
    disabledBtn: { opacity: 0.6 },
    completeBtnText: { color: '#fff', fontSize: typography.size.md, fontFamily: typography.family.bold },
    awaitingBox: { backgroundColor: colors.accent.filhoBg, borderRadius: radii.xl, padding: spacing['3'], alignItems: 'center', marginTop: spacing['2'] },
    awaitingText: { fontSize: typography.size.sm, color: colors.accent.filho, fontFamily: typography.family.semibold },
    approvedBox: { backgroundColor: colors.semantic.successBg, borderRadius: radii.xl, padding: spacing['3'], alignItems: 'center', marginTop: spacing['2'] },
    approvedText: { fontSize: typography.size.sm, color: colors.semantic.success, fontFamily: typography.family.semibold, textAlign: 'center' },
  });
}
