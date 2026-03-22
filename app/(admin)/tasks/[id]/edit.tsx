import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  getTaskEditState,
  getTaskWithAssignments,
  updateTask,
  type TaskDetail,
} from '@lib/tasks';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormFooter } from '@/components/ui/form-footer';
import { InlineMessage } from '@/components/ui/inline-message';
import { ScreenHeader } from '@/components/ui/screen-header';
import { StickyFooterScreen } from '@/components/ui/sticky-footer-screen';
import { TaskFormFields } from '@/components/tasks/task-form-fields';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';

export default function EditTaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const editState = useMemo(
    () => (task ? getTaskEditState(task) : null),
    [task],
  );

  const loadData = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError(null);
    setFormError(null);

    try {
      const { data, error: taskError } = await getTaskWithAssignments(id);

      if (taskError || !data) {
        setError(taskError ?? 'Não foi possível carregar a tarefa.');
        setTask(null);
        return;
      }

      setTask(data);
      setTitle(data.titulo);
      setDescription(data.descricao ?? '');
      setPoints(String(data.pontos));
    } catch {
      setError('Não foi possível carregar a tarefa agora.');
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => {
    loadData();
  }, [loadData]));
  useEffect(() => {
    if (loading || !task || !editState || editState.canEdit) {
      return;
    }

    router.dismissTo({
      pathname: '/(admin)/tasks/[id]',
      params: { id: task.id },
    });
  }, [editState, loading, router, task]);

  async function handleSave() {
    if (!task || !editState) return;

    setFormError(null);

    if (!title.trim()) {
      setFormError('Informe o título da tarefa.');
      return;
    }

    const parsedPoints = Number.parseInt(points, 10);

    if (Number.isNaN(parsedPoints) || parsedPoints <= 0) {
      setFormError('Pontos deve ser um número maior que zero.');
      return;
    }

    if (!editState.canEdit) {
      setFormError(editState.errorMessage);
      return;
    }

    setSaving(true);

    const { error: updateError } = await updateTask(task.id, {
      titulo: title.trim(),
      descricao: description.trim() || null,
      pontos: editState.canEditPoints ? parsedPoints : task.pontos,
      exige_evidencia: task.exige_evidencia,
    });

    setSaving(false);

    if (updateError) {
      setFormError(updateError);
      return;
    }

    router.dismissTo({
      pathname: '/(admin)/tasks/[id]',
      params: { id: task.id, updated: '1' },
    });
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.accent.admin} />
      </View>
    );
  }

  if (error || !task || !editState) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ScreenHeader title="Editar Tarefa" onBack={() => router.back()} backLabel="Detalhes" />
        <View style={styles.center}>
          <EmptyState error={error ?? 'Tarefa não encontrada.'} onRetry={loadData} />
        </View>
      </View>
    );
  }

  if (!editState.canEdit) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.accent.admin} />
      </View>
    );
  }

  return (
    <StickyFooterScreen
      title="Editar Tarefa"
      onBack={() => router.back()}
      backLabel="Detalhes"
      keyboardAvoiding
      contentPadding={spacing['6']}
      contentGap={spacing['5']}
      footer={(
        <FormFooter message={formError} compact includeSafeBottom={false}>
          <Button
            label="Salvar alterações"
            onPress={handleSave}
            loading={saving}
            accessibilityLabel="Salvar alterações da tarefa"
          />
        </FormFooter>
      )}
    >
      <StatusBar style={colors.statusBar} />
      {editState.infoMessage ? (
        <InlineMessage message={editState.infoMessage} variant="info" />
      ) : null}

      <View style={[styles.assignedChildrenCard, { backgroundColor: colors.bg.surface, borderColor: colors.border.default }]}>
        <Text style={[styles.assignedChildrenTitle, { color: colors.text.primary }]}>Campos bloqueados neste marco</Text>
        <Text style={[styles.assignedChildrenText, { color: colors.text.secondary }]}>
          Filhos atribuídos e frequência permanecem fixos para preservar o histórico e o escopo da tarefa.
        </Text>
      </View>

      <TaskFormFields
        title={title}
        description={description}
        points={points}
        frequency={task.frequencia}
        requiresEvidence={task.exige_evidencia}
        onTitleChange={setTitle}
        onDescriptionChange={setDescription}
        onPointsChange={setPoints}
        onFrequencyChange={(value) => setTask((previous) => previous ? { ...previous, frequencia: value } : previous)}
        onRequiresEvidenceChange={(value) => setTask((previous) => previous ? { ...previous, exige_evidencia: value } : previous)}
        autoFocusTitle
        frequencyEditable={false}
        pointsEditable={editState.canEditPoints}
      />
    </StickyFooterScreen>
  );
}

function makeStyles() {
  return StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing['6'],
    },
    container: {
      flex: 1,
    },
    assignedChildrenCard: {
      borderWidth: 1,
      borderRadius: radii.lg,
      borderCurve: 'continuous',
      padding: spacing['4'],
      gap: spacing['2'],
    },
    assignedChildrenTitle: {
      fontSize: typography.size.md,
      fontFamily: typography.family.semibold,
    },
    assignedChildrenText: {
      fontSize: typography.size.sm,
      lineHeight: typography.lineHeight.md,
    },
  });
}
